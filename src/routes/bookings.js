const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { SLOT_INTERVAL_MINUTES, nowWIB, todayWIB } = require('../config');
const jwt = require('jsonwebtoken');
const { requireKasir } = require('../middleware/auth');

const router = express.Router();

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Terlalu banyak booking. Coba lagi nanti.' }
});

router.get('/services', async (req, res) => {
  try {
    const services = await db.getServices(true);
    res.json({ success: true, data: services });
  } catch (err) {
    console.error('[bookings/services]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/barbers', async (req, res) => {
  try {
    const { date } = req.query;

    if (date) {
      const dayOfWeek = new Date(date + 'T12:00:00').getDay();
      const available = await db.getAvailableBarbersForDay(dayOfWeek);
      const barbers = available.map(s => ({
        id: s.barbers.id,
        name: s.barbers.name,
        speciality: s.barbers.speciality,
        shift_start: s.shift_start,
        shift_end: s.shift_end
      }));
      return res.json({ success: true, data: barbers });
    }

    const barbers = await db.getBarbers(true);
    res.json({ success: true, data: barbers });
  } catch (err) {
    console.error('[bookings/barbers]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/hours', async (req, res) => {
  try {
    const hours = await db.getOperatingHours();
    res.json({ success: true, data: hours });
  } catch (err) {
    console.error('[bookings/hours]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/slots', async (req, res) => {
  try {
    const { date, barber_id, duration } = req.query;
    if (!date || !barber_id || !duration)
      return res.json({ success: false, message: 'date, barber_id, dan duration wajib' });

    const dayOfWeek = new Date(date + 'T12:00:00').getDay();

    const schedule = await db.getBarberSchedule(barber_id, dayOfWeek);

    if (!schedule || schedule.is_off)
      return res.json({ success: true, data: [], message: 'Stylist tidak tersedia di hari ini' });

    const [openH, openM] = schedule.shift_start.split(':').map(Number);
    const [closeH, closeM] = schedule.shift_end.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    const existingBookings = await db.getBookingsByBarberAndDate(barber_id, date);
    const durationMin = parseInt(duration);
    const slots = [];

    const now = nowWIB();
    const today = todayWIB();
    const isToday = date === today;
    const nowMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : 0;

    for (let m = openMinutes; m + durationMin <= closeMinutes; m += SLOT_INTERVAL_MINUTES) {
      const slotStart = m;
      const slotEnd = m + durationMin;
      const timeStr = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

      if (isToday && slotStart <= nowMinutes) continue;

      const conflict = existingBookings.some(b => {
        const [bh, bm] = b.booking_time.split(':').map(Number);
        const [eh, em] = b.end_time.split(':').map(Number);
        return slotStart < eh * 60 + em && slotEnd > bh * 60 + bm;
      });

      slots.push({ time: timeStr, available: !conflict });
    }

    res.json({ success: true, data: slots });
  } catch (err) {
    console.error('[bookings/slots]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/create', bookingLimiter, async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_email, service_id, barber_id, booking_date, booking_time, notes, total_price_override, duration_override } = req.body;

    if (!customer_name || !customer_phone || !service_id || !barber_id || !booking_date || !booking_time)
      return res.json({ success: false, message: 'Semua field wajib diisi' });

    const service = await db.getServiceById(service_id);
    if (!service) return res.json({ success: false, message: 'Layanan tidak ditemukan' });

    // Only allow price/duration override from authenticated kasir/admin
    let isKasir = false;
    const token = req.cookies.session_token;
    if (token) {
      try {
        const user = jwt.verify(token, process.env.JWT_SECRET);
        if (['kasir', 'admin', 'superadmin'].includes(user.role)) {
          isKasir = true;
        }
      } catch { /* not authenticated — treat as public */ }
    }

    const actualDuration = (isKasir && duration_override) ? duration_override : service.duration_minutes;
    const actualPrice = (isKasir && total_price_override) ? total_price_override : service.price;

    const dayOfWeek = new Date(booking_date + 'T12:00:00').getDay();
    const schedule = await db.getBarberSchedule(barber_id, dayOfWeek);
    if (!schedule || schedule.is_off)
      return res.json({ success: false, message: 'Stylist tidak tersedia di hari ini' });

    const [h, m] = booking_time.split(':').map(Number);
    const endMinutes = h * 60 + m + actualDuration;
    const end_time = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    const existingBookings = await db.getBookingsByBarberAndDate(barber_id, booking_date);
    const slotStart = h * 60 + m;
    const slotEnd = endMinutes;
    const conflict = existingBookings.some(b => {
      const [bh, bm] = b.booking_time.split(':').map(Number);
      const [eh, em] = b.end_time.split(':').map(Number);
      return slotStart < eh * 60 + em && slotEnd > bh * 60 + bm;
    });
    if (conflict) return res.json({ success: false, message: 'Maaf, slot ini baru saja terisi. Silakan pilih waktu lain.' });

    const booking = await db.createBooking({
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      customer_email: customer_email?.trim() || null,
      service_id,
      barber_id,
      booking_date,
      booking_time,
      end_time,
      duration_minutes: actualDuration,
      total_price: actualPrice,
      notes: notes?.trim() || null
    });

    db.logActivity({ action: 'booking_create', category: 'booking', actor: customer_name, detail: `${service.name} - ${booking_date} ${booking_time}`, ip: req.ip });
    res.json({ success: true, data: booking });
  } catch (err) {
    if (err.code === '23505') {
      return res.json({ success: false, message: 'Maaf, slot ini baru saja terisi. Silakan pilih waktu lain.' });
    }
    console.error('[bookings/create]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/check/:id', async (req, res) => {
  try {
    const booking = await db.getBookingById(req.params.id);
    if (!booking) return res.json({ success: false, message: 'Booking tidak ditemukan' });
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('[bookings/check]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// KASIR ENDPOINTS (requires login)
// ============================================
router.get('/kasir/today', requireKasir, async (req, res) => {
  try {
    const date = req.query.date || todayWIB();
    const bookings = await db.getBookingsByDate(date);
    res.json({ success: true, data: bookings, date });
  } catch (err) {
    console.error('[kasir/today]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/kasir/week-counts', requireKasir, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.json({ success: false, message: 'start dan end wajib' });
    const bookings = await db.getBookingsByDateRange(start, end);
    const counts = {};
    bookings.forEach(b => {
      if (b.status !== 'cancelled') {
        counts[b.booking_date] = (counts[b.booking_date] || 0) + 1;
      }
    });
    res.json({ success: true, data: counts });
  } catch (err) {
    console.error('[kasir/week-counts]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/kasir/status/:id', requireKasir, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'confirmed', 'completed', 'cancelled', 'no_show'].includes(status))
      return res.json({ success: false, message: 'Status tidak valid' });
    const booking = await db.updateBookingStatus(req.params.id, status);
    db.logActivity({ action: 'booking_status', category: 'booking', actor: req.user.username, detail: `${req.params.id.slice(0,8)} → ${status}`, ip: req.ip });
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('[kasir/status]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

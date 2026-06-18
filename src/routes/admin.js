const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { DAYS_ID } = require('../config');

const router = express.Router();
router.use(requireAdmin);

// ============================================
// DASHBOARD / ANALYTICS
// ============================================
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = today.slice(0, 7) + '-01';

    const todayBookings = await db.getBookingsByDate(today);
    const monthBookings = await db.getBookingsForAnalytics(startOfMonth, today);

    const todayRevenue = todayBookings
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_price || 0), 0);

    const monthRevenue = monthBookings
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_price || 0), 0);

    const pendingCount = todayBookings.filter(b => b.status === 'pending').length;
    const confirmedCount = todayBookings.filter(b => b.status === 'confirmed').length;

    res.json({
      success: true,
      data: {
        today: {
          total: todayBookings.length,
          pending: pendingCount,
          confirmed: confirmedCount,
          completed: todayBookings.filter(b => b.status === 'completed').length,
          revenue: todayRevenue
        },
        month: {
          total: monthBookings.length,
          completed: monthBookings.filter(b => b.status === 'completed').length,
          cancelled: monthBookings.filter(b => b.status === 'cancelled').length,
          revenue: monthRevenue
        }
      }
    });
  } catch (err) {
    console.error('[admin/dashboard]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ANALYTICS - JAM SIBUK
// ============================================
router.get('/analytics/peak-hours', async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start || new Date().toISOString().split('T')[0].slice(0, 7) + '-01';
    const endDate = end || new Date().toISOString().split('T')[0];

    const bookings = await db.getBookingsForAnalytics(startDate, endDate);
    const hourCounts = {};
    for (let h = 0; h < 24; h++) hourCounts[h] = 0;

    bookings.forEach(b => {
      const hour = parseInt(b.booking_time.split(':')[0]);
      hourCounts[hour]++;
    });

    const data = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .filter(h => h.count > 0 || (h.hour >= 8 && h.hour <= 21));

    res.json({ success: true, data });
  } catch (err) {
    console.error('[admin/analytics/peak-hours]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ANALYTICS - HARI SIBUK
// ============================================
router.get('/analytics/peak-days', async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start || new Date().toISOString().split('T')[0].slice(0, 7) + '-01';
    const endDate = end || new Date().toISOString().split('T')[0];

    const bookings = await db.getBookingsForAnalytics(startDate, endDate);
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];

    bookings.forEach(b => {
      const day = new Date(b.booking_date + 'T00:00:00').getDay();
      dayCounts[day]++;
    });

    const data = dayCounts.map((count, i) => ({ day: DAYS_ID[i], dayIndex: i, count }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('[admin/analytics/peak-days]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ANALYTICS - LAYANAN POPULER
// ============================================
router.get('/analytics/services', async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start || new Date().toISOString().split('T')[0].slice(0, 7) + '-01';
    const endDate = end || new Date().toISOString().split('T')[0];

    const data = await db.getPopularServices(startDate, endDate);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[admin/analytics/services]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ANALYTICS - PERFORMA BARBER
// ============================================
router.get('/analytics/barbers', async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start || new Date().toISOString().split('T')[0].slice(0, 7) + '-01';
    const endDate = end || new Date().toISOString().split('T')[0];

    const data = await db.getBarberPerformance(startDate, endDate);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[admin/analytics/barbers]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ANALYTICS - REVENUE CHART (daily)
// ============================================
router.get('/analytics/revenue', async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start || new Date().toISOString().split('T')[0].slice(0, 7) + '-01';
    const endDate = end || new Date().toISOString().split('T')[0];

    const data = await db.getRevenueByDateRange(startDate, endDate);
    const dailyRevenue = {};
    data.forEach(b => {
      dailyRevenue[b.booking_date] = (dailyRevenue[b.booking_date] || 0) + (b.total_price || 0);
    });

    const result = Object.entries(dailyRevenue)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[admin/analytics/revenue]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// BOOKINGS MANAGEMENT
// ============================================
router.get('/bookings', async (req, res) => {
  try {
    const { page, status, date } = req.query;
    const result = await db.getAllBookings({ page: parseInt(page) || 1, status, date });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[admin/bookings]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/bookings/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'confirmed', 'completed', 'cancelled', 'no_show'].includes(status))
      return res.json({ success: false, message: 'Status tidak valid' });

    const booking = await db.updateBookingStatus(req.params.id, status);
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('[admin/bookings/status]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// SERVICES MANAGEMENT
// ============================================
router.get('/services', async (req, res) => {
  try {
    const services = await db.getServices(false);
    res.json({ success: true, data: services });
  } catch (err) {
    console.error('[admin/services]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/services', async (req, res) => {
  try {
    const service = await db.createService(req.body);
    res.json({ success: true, data: service });
  } catch (err) {
    console.error('[admin/services/create]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/services/:id', async (req, res) => {
  try {
    const service = await db.updateService(req.params.id, req.body);
    res.json({ success: true, data: service });
  } catch (err) {
    console.error('[admin/services/update]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// BARBERS MANAGEMENT
// ============================================
router.get('/barbers', async (req, res) => {
  try {
    const barbers = await db.getBarbers(false);
    res.json({ success: true, data: barbers });
  } catch (err) {
    console.error('[admin/barbers]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/barbers', async (req, res) => {
  try {
    const barber = await db.createBarber(req.body);
    res.json({ success: true, data: barber });
  } catch (err) {
    console.error('[admin/barbers/create]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/barbers/:id', async (req, res) => {
  try {
    const barber = await db.updateBarber(req.params.id, req.body);
    res.json({ success: true, data: barber });
  } catch (err) {
    console.error('[admin/barbers/update]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// OPERATING HOURS
// ============================================
router.get('/hours', async (req, res) => {
  try {
    const hours = await db.getOperatingHours();
    res.json({ success: true, data: hours });
  } catch (err) {
    console.error('[admin/hours]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/hours/:day', async (req, res) => {
  try {
    const hours = await db.updateOperatingHours(parseInt(req.params.day), req.body);
    res.json({ success: true, data: hours });
  } catch (err) {
    console.error('[admin/hours/update]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// EXPORT TO CSV (Excel-compatible)
// ============================================
router.get('/export/bookings', async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start || '2020-01-01';
    const endDate = end || new Date().toISOString().split('T')[0];
    const bookings = await db.getBookingsForAnalytics(startDate, endDate);

    const statusMap = { pending: 'Menunggu', confirmed: 'Dikonfirmasi', completed: 'Selesai', cancelled: 'Dibatalkan', no_show: 'Tidak Hadir' };
    const header = 'Tanggal,Waktu,Pelanggan,HP,Layanan,Kategori,Stylist,Durasi (menit),Harga,Status';
    const rows = bookings.map(b => [
      b.booking_date,
      b.booking_time?.slice(0, 5),
      `"${(b.customer_name || '').replace(/"/g, '""')}"`,
      b.customer_phone || '',
      `"${(b.services?.name || '').replace(/"/g, '""')}"`,
      b.services?.category || '',
      b.barbers?.name || '',
      b.duration_minutes,
      b.total_price,
      statusMap[b.status] || b.status
    ].join(','));

    const csv = '﻿' + header + '\n' + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bookings_${startDate}_${endDate}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[admin/export/bookings]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/export/services', async (req, res) => {
  try {
    const services = await db.getServices(false);
    const header = 'Nama,Deskripsi,Durasi (menit),Harga,Kategori,Status';
    const rows = services.map(s => [
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(s.description || '').replace(/"/g, '""')}"`,
      s.duration_minutes,
      s.price,
      s.category || '',
      s.is_active ? 'Aktif' : 'Nonaktif'
    ].join(','));

    const csv = '﻿' + header + '\n' + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="layanan.csv"');
    res.send(csv);
  } catch (err) {
    console.error('[admin/export/services]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/export/revenue', async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start || new Date().toISOString().split('T')[0].slice(0, 7) + '-01';
    const endDate = end || new Date().toISOString().split('T')[0];

    const bookings = await db.getBookingsForAnalytics(startDate, endDate);

    const daily = {};
    bookings.forEach(b => {
      if (!daily[b.booking_date]) daily[b.booking_date] = { total: 0, completed: 0, revenue: 0, cancelled: 0 };
      daily[b.booking_date].total++;
      if (b.status === 'completed') { daily[b.booking_date].completed++; daily[b.booking_date].revenue += b.total_price || 0; }
      if (b.status === 'cancelled') daily[b.booking_date].cancelled++;
    });

    const header = 'Tanggal,Total Booking,Selesai,Dibatalkan,Pendapatan';
    const rows = Object.entries(daily).sort().map(([date, d]) =>
      [date, d.total, d.completed, d.cancelled, d.revenue].join(',')
    );

    const csv = '﻿' + header + '\n' + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="revenue_${startDate}_${endDate}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[admin/export/revenue]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

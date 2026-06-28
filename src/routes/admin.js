const express = require('express');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { randomInt } = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { DAYS_ID, todayWIB } = require('../config');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'lumnstudio@gmail.com';
let otpStore = {};
let resetAttemptStore = {}; // { ip: { count, lockedUntil } }

const RESET_CONFIG_PATH = path.join(__dirname, '../config/reset-config.json');
const APP_CONFIG_PATH = path.join(__dirname, '../config/app-config.json');

function getAppConfig() {
  try { return JSON.parse(fs.readFileSync(APP_CONFIG_PATH, 'utf8')); }
  catch { return { posEnabled: true }; }
}

function saveAppConfig(config) {
  fs.mkdirSync(path.dirname(APP_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(APP_CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getResetConfig() {
  try { return JSON.parse(fs.readFileSync(RESET_CONFIG_PATH, 'utf8')); }
  catch { return { passwordHash: null }; }
}

function saveResetConfig(config) {
  fs.mkdirSync(path.dirname(RESET_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(RESET_CONFIG_PATH, JSON.stringify(config, null, 2));
}

const router = express.Router();
router.use(requireAdmin);

// ============================================
// DASHBOARD / ANALYTICS
// ============================================
router.get('/dashboard', async (req, res) => {
  try {
    const today = todayWIB();
    const { start, end } = req.query;
    const err = validateDateRange(start, end);
    if (err) return res.status(400).json({ success: false, message: err });
    const startDate = start || today;
    const endDate = end || today;

    const bookings = await db.getBookingsForAnalytics(startDate, endDate);

    const revenue = bookings
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_price || 0), 0);

    const pendingCount = bookings.filter(b => b.status === 'pending').length;
    const confirmedCount = bookings.filter(b => b.status === 'confirmed').length;
    const completedCount = bookings.filter(b => b.status === 'completed').length;

    res.json({
      success: true,
      data: {
        total: bookings.length,
        pending: pendingCount,
        confirmed: confirmedCount,
        completed: completedCount,
        revenue
      }
    });
  } catch (err) {
    console.error('[admin/dashboard]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// summary alias untuk pengeluaran tab (revenue saja)
router.get('/analytics/summary', async (req, res) => {
  try {
    const { start, end } = req.query;
    const today = todayWIB();
    const startDate = start || today;
    const endDate = end || today;
    const bookings = await db.getBookingsForAnalytics(startDate, endDate);
    const revenue = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.total_price || 0), 0);
    res.json({ success: true, revenue });
  } catch (err) {
    res.json({ success: true, revenue: 0 });
  }
});

// ============================================
// ANALYTICS - JAM SIBUK
// ============================================
router.get('/analytics/peak-hours', async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start || todayWIB().slice(0, 7) + '-01';
    const endDate = end || todayWIB();

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
    const startDate = start || todayWIB().slice(0, 7) + '-01';
    const endDate = end || todayWIB();

    const bookings = await db.getBookingsForAnalytics(startDate, endDate);
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];

    bookings.forEach(b => {
      const day = new Date(b.booking_date + 'T12:00:00').getDay();
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
    const startDate = start || todayWIB().slice(0, 7) + '-01';
    const endDate = end || todayWIB();

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
    const startDate = start || todayWIB().slice(0, 7) + '-01';
    const endDate = end || todayWIB();

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
    const startDate = start || todayWIB().slice(0, 7) + '-01';
    const endDate = end || todayWIB();

    const data = await db.getRevenueByDateRange(startDate, endDate);

    if (startDate === endDate) {
      const hourly = {};
      for (let h = 9; h <= 21; h++) hourly[h] = { omset: 0, net: 0 };
      data.forEach(b => {
        const hour = parseInt((b.booking_time || '0').split(':')[0]);
        if (!hourly[hour]) hourly[hour] = { omset: 0, net: 0 };
        hourly[hour].omset += b.total_price || 0;
        hourly[hour].net += (b.total_price || 0) - (b.services?.modal_price || 0);
      });
      const result = Object.entries(hourly)
        .map(([h, v]) => ({ hour: parseInt(h), label: String(h).padStart(2, '0') + ':00', amount: v.omset, net: v.net }))
        .sort((a, b) => a.hour - b.hour);
      return res.json({ success: true, data: result, mode: 'hourly' });
    }

    const daily = {};
    data.forEach(b => {
      if (!daily[b.booking_date]) daily[b.booking_date] = { omset: 0, net: 0 };
      daily[b.booking_date].omset += b.total_price || 0;
      daily[b.booking_date].net   += (b.total_price || 0) - (b.services?.modal_price || 0);
    });

    const result = Object.entries(daily)
      .map(([date, v]) => ({ date, amount: v.omset, net: v.net }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ success: true, data: result, mode: 'daily' });
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
    const { page, status, date, start, end } = req.query;
    const result = await db.getAllBookings({ page: parseInt(page) || 1, status, date, startDate: start, endDate: end });
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
    const { name, price, modal_price, duration_minutes, category, description, sort_order, is_active } = req.body;
    if (!name || !price) return res.json({ success: false, message: 'Nama dan harga wajib' });
    if (String(name).length > 100) return res.json({ success: false, message: 'Nama terlalu panjang' });
    const payload = { name: String(name).trim(), price: Number(price), modal_price: Number(modal_price) || 0, duration_minutes: Number(duration_minutes) || 30, category: category || 'potong', description: description || '', sort_order: Number(sort_order) || 0, is_active: is_active !== false };
    const service = await db.createService(payload);
    db.logActivity({ action: 'service_create', category: 'admin', actor: req.user.username, detail: payload.name, ip: req.ip });
    res.json({ success: true, data: service });
  } catch (err) {
    console.error('[admin/services/create]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/services/:id', async (req, res) => {
  try {
    const { name, price, modal_price, duration_minutes, category, description, sort_order, is_active } = req.body;
    const payload = {};
    if (name !== undefined) payload.name = String(name).trim();
    if (price !== undefined) payload.price = Number(price);
    if (modal_price !== undefined) payload.modal_price = Number(modal_price);
    if (duration_minutes !== undefined) payload.duration_minutes = Number(duration_minutes);
    if (category !== undefined) payload.category = category;
    if (description !== undefined) payload.description = description;
    if (sort_order !== undefined) payload.sort_order = Number(sort_order);
    if (is_active !== undefined) payload.is_active = Boolean(is_active);
    const service = await db.updateService(req.params.id, payload);
    db.logActivity({ action: 'service_update', category: 'admin', actor: req.user.username, detail: service.name, ip: req.ip });
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
    const { name, speciality, photo_url, sort_order, is_active } = req.body;
    if (!name) return res.json({ success: false, message: 'Nama wajib diisi' });
    if (String(name).length > 50) return res.json({ success: false, message: 'Nama terlalu panjang' });
    const payload = { name: String(name).trim(), speciality: speciality || '', photo_url: photo_url || null, sort_order: Number(sort_order) || 0, is_active: is_active !== false };
    const barber = await db.createBarber(payload);
    db.logActivity({ action: 'barber_create', category: 'admin', actor: req.user.username, detail: payload.name, ip: req.ip });
    res.json({ success: true, data: barber });
  } catch (err) {
    console.error('[admin/barbers/create]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/barbers/schedules', async (req, res) => {
  try {
    const data = await db.getAllBarberSchedules();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[admin/barbers/schedules]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/barbers/:id', async (req, res) => {
  try {
    const barber    = await db.getBarberById(req.params.id);
    if (!barber) return res.json({ success: false, message: 'Barber tidak ditemukan' });
    const schedules = await db.getBarberSchedules(req.params.id);
    res.json({ success: true, data: { ...barber, schedules } });
  } catch (err) {
    console.error('[admin/barbers/get]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/barbers/:id', async (req, res) => {
  try {
    const { name, speciality, photo_url, sort_order, is_active } = req.body;
    const payload = {};
    if (name !== undefined) payload.name = String(name).trim();
    if (speciality !== undefined) payload.speciality = speciality;
    if (photo_url !== undefined) payload.photo_url = photo_url;
    if (sort_order !== undefined) payload.sort_order = Number(sort_order);
    if (is_active !== undefined) payload.is_active = Boolean(is_active);
    const barber = await db.updateBarber(req.params.id, payload);
    res.json({ success: true, data: barber });
  } catch (err) {
    console.error('[admin/barbers/update]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/barbers/:id/schedule', async (req, res) => {
  try {
    const { schedules } = req.body; // array of { day_of_week, shift_start, shift_end, is_off }
    if (!Array.isArray(schedules)) return res.json({ success: false, message: 'Format tidak valid' });
    for (const s of schedules) {
      await db.upsertBarberSchedule(req.params.id, s.day_of_week, {
        shift_start: s.shift_start,
        shift_end:   s.shift_end,
        is_off:      s.is_off
      });
    }
    res.json({ success: true, message: 'Jadwal disimpan' });
  } catch (err) {
    console.error('[admin/barbers/schedule]', err.message);
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
// EXPORT TO XLSX
// ============================================
const ExcelJS = require('exceljs');

const HEADER_STYLE = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } }, alignment: { horizontal: 'center' } };
const NUM_FMT = '#,##0';

router.get('/export/bookings', async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start || '2020-01-01';
    const endDate = end || todayWIB();
    const bookings = await db.getBookingsForAnalytics(startDate, endDate);
    const statusMap = { pending: 'Menunggu', confirmed: 'Dikonfirmasi', completed: 'Selesai', cancelled: 'Dibatalkan', no_show: 'Tidak Hadir' };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Booking');
    ws.columns = [
      { header: 'Tanggal', key: 'date', width: 14 },
      { header: 'Waktu', key: 'time', width: 8 },
      { header: 'Pelanggan', key: 'name', width: 20 },
      { header: 'HP', key: 'phone', width: 16 },
      { header: 'Layanan', key: 'service', width: 22 },
      { header: 'Stylist', key: 'stylist', width: 14 },
      { header: 'Durasi', key: 'duration', width: 8 },
      { header: 'Harga', key: 'price', width: 14 },
      { header: 'Status', key: 'status', width: 14 }
    ];
    ws.getRow(1).eachCell(c => Object.assign(c, HEADER_STYLE));

    bookings.forEach(b => {
      ws.addRow({ date: b.booking_date, time: b.booking_time?.slice(0, 5), name: b.customer_name, phone: b.customer_phone, service: b.services?.name, stylist: b.barbers?.name, duration: b.duration_minutes, price: b.total_price, status: statusMap[b.status] || b.status });
    });
    ws.getColumn('price').numFmt = NUM_FMT;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="booking_${startDate}_${endDate}.xlsx"`);
    await wb.xlsx.write(res);
  } catch (err) {
    console.error('[admin/export/bookings]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/export/services', async (req, res) => {
  try {
    const services = await db.getServices(false);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Layanan');
    ws.columns = [
      { header: 'Nama', key: 'name', width: 24 },
      { header: 'Deskripsi', key: 'desc', width: 30 },
      { header: 'Durasi (menit)', key: 'duration', width: 14 },
      { header: 'Harga', key: 'price', width: 14 },
      { header: 'Kategori', key: 'cat', width: 12 },
      { header: 'Status', key: 'status', width: 10 }
    ];
    ws.getRow(1).eachCell(c => Object.assign(c, HEADER_STYLE));

    services.forEach(s => {
      ws.addRow({ name: s.name, desc: s.description, duration: s.duration_minutes, price: s.price, cat: s.category, status: s.is_active ? 'Aktif' : 'Nonaktif' });
    });
    ws.getColumn('price').numFmt = NUM_FMT;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="layanan.xlsx"');
    await wb.xlsx.write(res);
  } catch (err) {
    console.error('[admin/export/services]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/export/revenue', async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start || todayWIB().slice(0, 7) + '-01';
    const endDate = end || todayWIB();
    const bookings = await db.getBookingsForAnalytics(startDate, endDate);

    const daily = {};
    bookings.forEach(b => {
      if (!daily[b.booking_date]) daily[b.booking_date] = { total: 0, completed: 0, revenue: 0, cancelled: 0 };
      daily[b.booking_date].total++;
      if (b.status === 'completed') { daily[b.booking_date].completed++; daily[b.booking_date].revenue += b.total_price || 0; }
      if (b.status === 'cancelled') daily[b.booking_date].cancelled++;
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Revenue');
    ws.columns = [
      { header: 'Tanggal', key: 'date', width: 14 },
      { header: 'Total Booking', key: 'total', width: 14 },
      { header: 'Selesai', key: 'completed', width: 10 },
      { header: 'Dibatalkan', key: 'cancelled', width: 12 },
      { header: 'Pendapatan', key: 'revenue', width: 16 }
    ];
    ws.getRow(1).eachCell(c => Object.assign(c, HEADER_STYLE));

    Object.entries(daily).sort().forEach(([date, d]) => {
      ws.addRow({ date, total: d.total, completed: d.completed, cancelled: d.cancelled, revenue: d.revenue });
    });
    ws.getColumn('revenue').numFmt = NUM_FMT;

    const totalRow = ws.addRow({ date: 'TOTAL', total: '', completed: '', cancelled: '', revenue: '' });
    const lastDataRow = ws.rowCount;
    totalRow.getCell('total').value = { formula: `SUM(B2:B${lastDataRow - 1})` };
    totalRow.getCell('revenue').value = { formula: `SUM(E2:E${lastDataRow - 1})` };
    totalRow.eachCell(c => { c.font = { bold: true }; });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="revenue_${startDate}_${endDate}.xlsx"`);
    await wb.xlsx.write(res);
  } catch (err) {
    console.error('[admin/export/revenue]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// BARBER - GANTI / SET PASSWORD
// ============================================
router.put('/barbers/:id/password', async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.json({ success: false, message: 'Password minimal 6 karakter' });
    if (newPassword !== confirmPassword)
      return res.json({ success: false, message: 'Konfirmasi password tidak cocok' });

    const barber = await db.getBarberById(req.params.id);
    if (!barber) return res.json({ success: false, message: 'Barber tidak ditemukan' });

    // Cari atau buat user account berdasarkan nama barber
    let user = await db.getUserByUsername(barber.name.toLowerCase().replace(/\s+/g, '_'));
    if (!user) {
      // Coba cari by full_name (exact match)
      const allUsers = await db.getNonAdminUsers();
      user = allUsers.find(u => u.full_name?.toLowerCase() === barber.name.toLowerCase());
    }

    const hash = await bcrypt.hash(newPassword, 10);

    if (user) {
      await db.updateUserPassword(user.username, hash);
      await db.incrementTokenVersion(user.username);
      // Pastikan role-nya barber
      if (user.role !== 'barber') {
        await db.supabase.from('users').update({ role: 'barber', full_name: barber.name }).eq('username', user.username);
      }
      res.json({ success: true, message: `Password barber "${barber.name}" berhasil diubah` });
    } else {
      // Buat akun baru
      const username = barber.name.toLowerCase().replace(/\s+/g, '_');
      await db.createUser({
        username,
        password_hash: hash,
        full_name: barber.name,
        role: 'barber',
        phone: '',
        email: ''
      });
      res.json({ success: true, message: `Akun barber "${barber.name}" dibuat. Username: ${username}` });
    }
  } catch (err) {
    console.error('[admin/barbers/password]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// STAFF - KELOLA AKUN (role + password)
// ============================================
router.get('/staff', async (req, res) => {
  try {
    const users = await db.getNonAdminUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('[admin/staff]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/staff/:username/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['kasir', 'barber'].includes(role))
      return res.json({ success: false, message: 'Role tidak valid' });

    // Pastikan bukan admin sebelum update
    const target = await db.getUserByUsername(req.params.username);
    if (!target) return res.json({ success: false, message: 'User tidak ditemukan' });
    if (target.role === 'admin' || target.role === 'superadmin') return res.json({ success: false, message: 'Tidak bisa mengubah role ini' });

    const { error } = await db.supabase.from('users').update({ role }).eq('username', req.params.username);
    if (error) throw error;
    res.json({ success: true, message: `Role ${req.params.username} berhasil diubah ke ${role}` });
  } catch (err) {
    console.error('[admin/staff/role]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// KASIR - GANTI PASSWORD
// ============================================
router.get('/kasir/list', async (req, res) => {
  try {
    const users = await db.getNonAdminUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('[admin/kasir/list]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/kasir', async (req, res) => {
  try {
    const { username, fullName, password } = req.body;
    if (!username || !password || password.length < 6)
      return res.json({ success: false, message: 'Username dan password (min 6 karakter) wajib diisi' });

    const existing = await db.getUserByUsername(username.toLowerCase().trim());
    if (existing)
      return res.json({ success: false, message: 'Username sudah digunakan' });

    await db.createUser({
      username: username.toLowerCase().trim(),
      password_hash: await bcrypt.hash(password, 10),
      full_name: fullName || username,
      role: 'kasir',
      phone: '',
      email: ''
    });
    res.json({ success: true, message: `Akun kasir "${username}" berhasil dibuat` });
  } catch (err) {
    console.error('[admin/kasir/create]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/kasir/:username/password', async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.json({ success: false, message: 'Password minimal 6 karakter' });
    if (newPassword !== confirmPassword)
      return res.json({ success: false, message: 'Konfirmasi password tidak cocok' });

    const user = await db.getUserByUsername(req.params.username);
    if (!user || user.role === 'admin')
      return res.json({ success: false, message: 'User tidak ditemukan' });

    await db.updateUserPassword(req.params.username, await bcrypt.hash(newPassword, 10));
    await db.incrementTokenVersion(req.params.username);
    res.json({ success: true, message: `Password kasir "${req.params.username}" berhasil diubah` });
  } catch (err) {
    console.error('[admin/kasir/password]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// RESET CONFIG - SET PASSWORD
// ============================================
router.post('/settings/reset-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.json({ success: false, message: 'Password minimal 6 karakter' });

    const config = getResetConfig();
    if (config.passwordHash) {
      if (!currentPassword)
        return res.json({ success: false, message: 'Masukkan password reset saat ini' });

      const ip = req.ip;
      const attempt = resetAttemptStore[ip] || { count: 0, lockedUntil: 0 };
      if (Date.now() < attempt.lockedUntil) {
        const menit = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
        return res.status(429).json({ success: false, message: `Terlalu banyak percobaan. Coba lagi dalam ${menit} menit.` });
      }

      const valid = await bcrypt.compare(currentPassword, config.passwordHash);
      if (!valid) {
        attempt.count = (attempt.count || 0) + 1;
        if (attempt.count >= 5) {
          attempt.lockedUntil = Date.now() + 15 * 60 * 1000;
          attempt.count = 0;
        }
        resetAttemptStore[ip] = attempt;
        return res.json({ success: false, message: 'Password saat ini salah' });
      }
      delete resetAttemptStore[ip];
    }

    saveResetConfig({ passwordHash: await bcrypt.hash(newPassword, 10) });
    res.json({ success: true, message: 'Password reset berhasil diatur' });
  } catch (err) {
    console.error('[admin/settings/reset-password]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/settings/reset-config', (req, res) => {
  const config = getResetConfig();
  res.json({ success: true, isSet: !!config.passwordHash });
});

// ============================================
// RESET DASHBOARD
// ============================================
router.post('/reset', async (req, res) => {
  try {
    const ip = req.ip;
    const attempt = resetAttemptStore[ip] || { count: 0, lockedUntil: 0 };

    if (Date.now() < attempt.lockedUntil) {
      const menit = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ success: false, message: `Terlalu banyak percobaan. Coba lagi dalam ${menit} menit.` });
    }

    const { password } = req.body;
    const config = getResetConfig();
    if (!config.passwordHash)
      return res.json({ success: false, message: 'Password reset belum diatur di Pengaturan' });

    const valid = await bcrypt.compare(password, config.passwordHash);
    if (!valid) {
      attempt.count = (attempt.count || 0) + 1;
      if (attempt.count >= 5) {
        attempt.lockedUntil = Date.now() + 15 * 60 * 1000;
        attempt.count = 0;
      }
      resetAttemptStore[ip] = attempt;
      return res.json({ success: false, message: 'Password salah' });
    }

    delete resetAttemptStore[ip];
    await db.resetAllBookings();
    db.logActivity({ action: 'reset_bookings', category: 'admin', actor: req.user.username, detail: 'All bookings deleted', ip: req.ip });
    res.json({ success: true, message: 'Semua data booking berhasil dihapus' });
  } catch (err) {
    console.error('[admin/reset]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// APP CONFIG (POS toggle, etc)
// ============================================
router.get('/app-config', (req, res) => {
  res.json({ success: true, data: getAppConfig() });
});

router.put('/app-config', (req, res) => {
  try {
    const config = getAppConfig();
    if (req.body.posEnabled !== undefined) config.posEnabled = !!req.body.posEnabled;
    saveAppConfig(config);
    res.json({ success: true, data: config });
  } catch (err) {
    console.error('[admin/app-config]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ADMIN PASSWORD CHANGE (with email OTP)
// ============================================
function generateOTP() {
  return String(randomInt(100000, 1000000));
}

async function sendOTPEmail(otp) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || ADMIN_EMAIL,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: '"LUMEN\'S STUDIO" <' + (process.env.SMTP_USER || ADMIN_EMAIL) + '>',
    to: ADMIN_EMAIL,
    subject: 'Kode Verifikasi - Ubah Password Admin',
    html: '<div style="font-family:Inter,sans-serif;max-width:400px;margin:0 auto;padding:24px;">' +
      '<h2 style="font-size:1.2rem;font-weight:800;margin-bottom:8px;">LUMEN\'S STUDIO</h2>' +
      '<p style="color:#555;font-size:0.9rem;margin-bottom:20px;">Kode verifikasi untuk mengubah password admin:</p>' +
      '<div style="background:#f5f5f5;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">' +
      '<span style="font-size:2rem;font-weight:800;letter-spacing:8px;color:#1a1a1a;">' + otp + '</span>' +
      '</div>' +
      '<p style="color:#999;font-size:0.75rem;">Kode berlaku 5 menit. Jika tidak merasa meminta, abaikan email ini.</p>' +
      '</div>'
  });
}

router.post('/change-password/request-otp', async (req, res) => {
  try {
    if (!process.env.SMTP_PASS && !process.env.DEV_SMTP_BYPASS) {
      return res.json({ success: false, message: 'SMTP belum dikonfigurasi. Tambahkan SMTP_USER dan SMTP_PASS di environment.' });
    }

    const existing = otpStore[req.user.username];
    if (existing && Date.now() < existing.expires - (4 * 60 * 1000)) {
      return res.json({ success: false, message: 'Kode sudah dikirim. Tunggu 1 menit sebelum minta ulang.' });
    }

    const otp = generateOTP();
    otpStore[req.user.username] = { otp, expires: Date.now() + 5 * 60 * 1000 };

    if (process.env.DEV_SMTP_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] OTP untuk ${req.user.username}: ${otp}`);
    } else {
      await sendOTPEmail(otp);
    }
    res.json({ success: true, message: 'Kode verifikasi dikirim ke ' + ADMIN_EMAIL.replace(/(.{2}).*(@.*)/, '$1***$2') });
  } catch (err) {
    console.error('[admin/change-password/request-otp]', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengirim email. Periksa konfigurasi SMTP.' });
  }
});

router.post('/change-password/verify', async (req, res) => {
  try {
    const { otp, newPassword, confirmPassword } = req.body;
    if (!otp || !newPassword) return res.json({ success: false, message: 'OTP dan password baru wajib diisi' });
    if (newPassword.length < 6) return res.json({ success: false, message: 'Password minimal 6 karakter' });
    if (newPassword !== confirmPassword) return res.json({ success: false, message: 'Konfirmasi password tidak cocok' });

    const stored = otpStore[req.user.username];
    if (!stored) return res.json({ success: false, message: 'Kode verifikasi belum diminta' });
    if (Date.now() > stored.expires) {
      delete otpStore[req.user.username];
      return res.json({ success: false, message: 'Kode verifikasi sudah kedaluwarsa' });
    }
    if (stored.otp !== otp) {
      stored.attempts = (stored.attempts || 0) + 1;
      if (stored.attempts >= 5) delete otpStore[req.user.username];
      return res.json({ success: false, message: 'Kode verifikasi salah' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.updateUserPassword(req.user.username, hash);
    await db.incrementTokenVersion(req.user.username);
    delete otpStore[req.user.username];

    db.logActivity({ action: 'admin_password_change', category: 'admin', actor: req.user.username, detail: 'Password changed via OTP', ip: req.ip });
    res.json({ success: true, message: 'Password admin berhasil diubah. Silakan login ulang.' });
  } catch (err) {
    console.error('[admin/change-password/verify]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// BACKUP
// ============================================
const { generateBackup, sendBackupEmail } = require('../backup');

router.get('/backup/download', requireAdmin, async (req, res) => {
  try {
    const { json, totalRows, generatedAt } = await generateBackup();
    const filename = `lumens-backup-${generatedAt.slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    db.logActivity({ action: 'backup_download', category: 'admin', actor: req.user.username, detail: `${totalRows} rows`, ip: req.ip });
    res.send(json);
  } catch (err) {
    console.error('[backup/download]', err.message);
    res.status(500).json({ success: false, message: 'Gagal generate backup' });
  }
});

router.post('/backup/send-email', requireAdmin, async (req, res) => {
  try {
    const { totalRows, filename, recipient } = await sendBackupEmail();
    db.logActivity({ action: 'backup_email', category: 'admin', actor: req.user.username, detail: `${totalRows} rows → ${recipient}`, ip: req.ip });
    res.json({ success: true, message: `Backup dikirim ke ${recipient} (${totalRows.toLocaleString('id-ID')} baris)` });
  } catch (err) {
    console.error('[backup/send-email]', err.message);
    res.status(500).json({ success: false, message: err.message || 'Gagal kirim backup' });
  }
});

// ============================================================
// PENGELUARAN (EXPENSES) — file-based storage
// ============================================================
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_KATEGORI = ['gaji','bahan','sewa','listrik','peralatan','promosi','lainnya'];
const EXPENSE_PATH = path.join(__dirname, '../config/pengeluaran.json');

function validateDateRange(start, end) {
  if (start && !DATE_RE.test(start)) return 'Format tanggal start tidak valid';
  if (end   && !DATE_RE.test(end))   return 'Format tanggal end tidak valid';
  return null;
}

function loadExpenses() {
  try { return JSON.parse(fs.readFileSync(EXPENSE_PATH, 'utf8')); }
  catch { return []; }
}
function saveExpenses(list) {
  fs.mkdirSync(path.dirname(EXPENSE_PATH), { recursive: true });
  fs.writeFileSync(EXPENSE_PATH, JSON.stringify(list, null, 2));
}

// GET /api/admin/pengeluaran?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/pengeluaran', requireAdmin, (req, res) => {
  const { start, end } = req.query;
  if (start && !DATE_RE.test(start)) return res.status(400).json({ success: false, message: 'Format tanggal tidak valid' });
  if (end   && !DATE_RE.test(end))   return res.status(400).json({ success: false, message: 'Format tanggal tidak valid' });
  let list = loadExpenses();
  if (start) list = list.filter(e => e.tanggal >= start);
  if (end)   list = list.filter(e => e.tanggal <= end);
  list.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  res.json({ success: true, data: list });
});

// POST /api/admin/pengeluaran
router.post('/pengeluaran', requireAdmin, (req, res) => {
  const { tanggal, kategori, keterangan, jumlah } = req.body;
  if (!tanggal || !kategori || !jumlah) return res.json({ success: false, message: 'tanggal, kategori, jumlah wajib diisi' });
  if (!DATE_RE.test(tanggal)) return res.json({ success: false, message: 'Format tanggal tidak valid' });
  if (!VALID_KATEGORI.includes(kategori)) return res.json({ success: false, message: 'Kategori tidak valid' });
  if (keterangan && String(keterangan).length > 200) return res.json({ success: false, message: 'Keterangan maks 200 karakter' });
  const jml = Number(jumlah);
  if (!jml || jml < 0 || jml > 1_000_000_000) return res.json({ success: false, message: 'Jumlah tidak valid' });
  const list = loadExpenses();
  const item = { id: Date.now().toString(), tanggal, kategori, keterangan: String(keterangan || '').trim(), jumlah: jml, created_at: new Date().toISOString() };
  list.push(item);
  saveExpenses(list);
  res.json({ success: true, data: item });
});

// PUT /api/admin/pengeluaran/:id
router.put('/pengeluaran/:id', requireAdmin, (req, res) => {
  const list = loadExpenses();
  const idx = list.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.json({ success: false, message: 'Tidak ditemukan' });
  const { tanggal, kategori, keterangan, jumlah } = req.body;
  if (!DATE_RE.test(tanggal)) return res.json({ success: false, message: 'Format tanggal tidak valid' });
  if (!VALID_KATEGORI.includes(kategori)) return res.json({ success: false, message: 'Kategori tidak valid' });
  if (keterangan && String(keterangan).length > 200) return res.json({ success: false, message: 'Keterangan maks 200 karakter' });
  const jml = Number(jumlah);
  if (!jml || jml < 0 || jml > 1_000_000_000) return res.json({ success: false, message: 'Jumlah tidak valid' });
  list[idx] = { ...list[idx], tanggal, kategori, keterangan: String(keterangan || '').trim(), jumlah: jml };
  saveExpenses(list);
  res.json({ success: true, data: list[idx] });
});

// DELETE /api/admin/pengeluaran/:id
router.delete('/pengeluaran/:id', requireAdmin, (req, res) => {
  const list = loadExpenses();
  const idx = list.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.json({ success: false, message: 'Tidak ditemukan' });
  list.splice(idx, 1);
  saveExpenses(list);
  res.json({ success: true });
});

module.exports = router;

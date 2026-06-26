const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { DAYS_ID, todayWIB } = require('../config');

const RESET_CONFIG_PATH = path.join(__dirname, '../config/reset-config.json');

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
    const service = await db.createService(req.body);
    db.logActivity({ action: 'service_create', category: 'admin', actor: req.user.username, detail: req.body.name, ip: req.ip });
    res.json({ success: true, data: service });
  } catch (err) {
    console.error('[admin/services/create]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/services/:id', async (req, res) => {
  try {
    const service = await db.updateService(req.params.id, req.body);
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
    const barber = await db.createBarber(req.body);
    db.logActivity({ action: 'barber_create', category: 'admin', actor: req.user.username, detail: req.body.name, ip: req.ip });
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
    const barber = await db.updateBarber(req.params.id, req.body);
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
      const valid = await bcrypt.compare(currentPassword, config.passwordHash);
      if (!valid)
        return res.json({ success: false, message: 'Password saat ini salah' });
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
    const { password } = req.body;
    const config = getResetConfig();
    if (!config.passwordHash)
      return res.json({ success: false, message: 'Password reset belum diatur di Pengaturan' });

    const valid = await bcrypt.compare(password, config.passwordHash);
    if (!valid)
      return res.json({ success: false, message: 'Password salah' });

    await db.resetAllBookings();
    db.logActivity({ action: 'reset_bookings', category: 'admin', actor: req.user.username, detail: 'All bookings deleted', ip: req.ip });
    res.json({ success: true, message: 'Semua data booking berhasil dihapus' });
  } catch (err) {
    console.error('[admin/reset]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

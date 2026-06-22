const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { nowWIB, todayWIB } = require('../config');

const router = express.Router();
router.use(requireAuth);

// Match logged-in user to barber profile by full_name
async function getMyBarber(req) {
  const fullName = req.user.fullName || req.user.username;
  return await db.getBarberByName(fullName);
}

router.get('/me', async (req, res) => {
  try {
    const barber = await getMyBarber(req);
    if (!barber) return res.json({ success: false, message: 'Profil barber tidak ditemukan. Hubungi admin.' });
    res.json({ success: true, data: barber });
  } catch (err) {
    console.error('[barber/me]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const barber = await getMyBarber(req);
    if (!barber) return res.json({ success: false, message: 'Profil barber tidak ditemukan' });

    const { period, date } = req.query;
    const today = todayWIB();
    let startDate, endDate = today;

    if (period === 'date' && date) {
      startDate = date;
      endDate = date;
    } else if (period === 'week') {
      const d = nowWIB();
      d.setDate(d.getDate() - d.getDay() + 1);
      startDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    } else if (period === 'month') {
      startDate = today.slice(0, 7) + '-01';
    } else if (period === 'all') {
      startDate = '2000-01-01';
    } else {
      startDate = today;
    }

    const bookings = await db.getBarberStats(barber.id, startDate, endDate);

    const total     = bookings.length;
    const completed = bookings.filter(b => b.status === 'completed').length;
    const pending   = bookings.filter(b => b.status === 'pending').length;
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const cancelled = bookings.filter(b => ['cancelled', 'no_show'].includes(b.status)).length;
    const revenue   = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.total_price || 0), 0);
    const netRevenue = bookings.filter(b => b.status === 'completed').reduce((s, b) => {
      const modal = b.services?.modal_price || 0;
      return s + (b.total_price || 0) - modal;
    }, 0);
    const rate      = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      success: true,
      data: { barber, total, completed, pending, confirmed, cancelled, revenue, netRevenue, rate, bookings }
    });
  } catch (err) {
    console.error('[barber/stats]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/change-password', async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.json({ success: false, message: 'Password baru minimal 6 karakter' });
    if (newPassword !== confirmPassword)
      return res.json({ success: false, message: 'Konfirmasi password tidak cocok' });

    const user = await db.getUserByUsername(req.user.username);
    if (!user) return res.json({ success: false, message: 'Akun tidak ditemukan' });

    const valid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!valid) return res.json({ success: false, message: 'Password lama salah' });

    await db.updateUserPassword(req.user.username, await bcrypt.hash(newPassword, 10));
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (err) {
    console.error('[barber/change-password]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/schedule', async (req, res) => {
  try {
    const barber = await getMyBarber(req);
    if (!barber) return res.json({ success: false, message: 'Profil barber tidak ditemukan' });
    const schedules = await db.getBarberSchedules(barber.id);
    res.json({ success: true, data: { ...barber, schedules } });
  } catch (err) {
    console.error('[barber/schedule]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/schedule', async (req, res) => {
  try {
    const barber = await getMyBarber(req);
    if (!barber) return res.json({ success: false, message: 'Profil barber tidak ditemukan' });

    const { schedules } = req.body;
    if (!Array.isArray(schedules)) return res.json({ success: false, message: 'Format tidak valid' });

    for (const s of schedules) {
      await db.upsertBarberSchedule(barber.id, s.day_of_week, {
        shift_start: s.shift_start,
        shift_end: s.shift_end,
        is_off: s.is_off
      });
    }
    db.logActivity({ action: 'schedule_update', category: 'barber', actor: req.user.username, detail: barber.name, ip: req.ip });
    res.json({ success: true, message: 'Jadwal disimpan' });
  } catch (err) {
    console.error('[barber/schedule]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

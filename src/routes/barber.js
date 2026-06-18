const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

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

    const { period } = req.query;
    const today = new Date().toISOString().split('T')[0];
    let startDate;

    if (period === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay() + 1);
      startDate = d.toISOString().split('T')[0];
    } else if (period === 'month') {
      startDate = today.slice(0, 7) + '-01';
    } else if (period === 'all') {
      startDate = '2000-01-01';
    } else {
      startDate = today;
    }

    const bookings = await db.getBarberStats(barber.id, startDate, today);

    const total     = bookings.length;
    const completed = bookings.filter(b => b.status === 'completed').length;
    const pending   = bookings.filter(b => b.status === 'pending').length;
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const cancelled = bookings.filter(b => ['cancelled', 'no_show'].includes(b.status)).length;
    const revenue   = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.total_price || 0), 0);
    const rate      = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      success: true,
      data: { barber, total, completed, pending, confirmed, cancelled, revenue, rate, bookings }
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

module.exports = router;

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { COOKIE_OPTIONS } = require('../config');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.json({ success: false, message: 'Username dan password wajib diisi' });

    const user = await db.getUserByUsername(username.toLowerCase().trim());
    if (!user || !user.is_active)
      return res.json({ success: false, message: 'Username atau password salah' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.json({ success: false, message: 'Username atau password salah' });

    // Build JWT payload; include barberId for barber role (VULN-006)
    const payload = { username: user.username, role: user.role, fullName: user.full_name };
    if (user.role === 'barber') {
      const barber = await db.getBarberByName(user.full_name);
      if (barber) payload.barberId = barber.id;
    }

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie('session_token', token, COOKIE_OPTIONS);
    db.logActivity({ action: 'login', category: 'auth', actor: user.username, detail: `Role: ${user.role}`, ip: req.ip });
    res.json({ success: true, user: { username: user.username, role: user.role, fullName: user.full_name } });
  } catch (err) {
    console.error('[auth/login]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('session_token', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });
  const token = req.cookies.session_token;
  if (token) { try { const u = jwt.verify(token, process.env.JWT_SECRET); db.logActivity({ action: 'logout', category: 'auth', actor: u.username, ip: req.ip }); } catch {} }
  res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.post('/setup', async (req, res) => {
  if (process.env.NODE_ENV === 'production')
    return res.status(404).json({ success: false, message: 'Not found' });

  try {
    const existing = await db.getUserByUsername('admin');
    if (existing) return res.json({ success: false, message: 'Admin sudah ada' });

    const hash = await bcrypt.hash('admin123', 12);
    await db.createUser({
      username: 'admin',
      password_hash: hash,
      full_name: 'Administrator',
      role: 'admin',
      phone: '',
      email: ''
    });
    res.json({ success: true, message: 'Admin created. Username: admin, Password: admin123' });
  } catch (err) {
    console.error('[auth/setup]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

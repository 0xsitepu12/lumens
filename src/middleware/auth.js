const jwt = require('jsonwebtoken');
const db = require('../db');

async function requireAuth(req, res, next) {
  const token = req.cookies.session_token;
  if (!token) return res.status(401).json({ success: false, message: 'Login required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Cek token_version agar sesi lama langsung invalid setelah ganti password
    if (decoded.tokenVersion !== undefined) {
      const user = await db.getUserByUsername(decoded.username);
      if (!user || user.token_version !== decoded.tokenVersion) {
        res.clearCookie('session_token');
        return res.status(401).json({ success: false, message: 'Session expired' });
      }
    }

    req.user = decoded;
    next();
  } catch {
    res.clearCookie('session_token');
    return res.status(401).json({ success: false, message: 'Session expired' });
  }
}

function requireKasir(req, res, next) {
  requireAuth(req, res, () => {
    if (!['kasir', 'admin', 'superadmin'].includes(req.user.role))
      return res.status(403).json({ success: false, message: 'Forbidden' });
    next();
  });
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin')
      return res.status(403).json({ success: false, message: 'Forbidden' });
    next();
  });
}

function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'superadmin')
      return res.status(403).json({ success: false, message: 'Forbidden' });
    next();
  });
}

module.exports = { requireAuth, requireKasir, requireAdmin, requireSuperAdmin };

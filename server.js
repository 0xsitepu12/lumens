require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET harus minimal 32 karakter');
  process.exit(1);
}

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'cdnjs.cloudflare.com'],
      connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
      imgSrc: ["'self'", 'data:', 'blob:']
    }
  }
}));

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

const isLocalhost = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 150,
  skip: isLocalhost
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: isLocalhost,
  message: { success: false, message: 'Terlalu banyak percobaan. Coba lagi nanti.' }
});

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.use('/api/auth', authLimiter, require('./src/routes/auth'));
app.use('/api/booking', require('./src/routes/bookings'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/barber', require('./src/routes/barber'));
app.use('/api/superadmin', require('./src/routes/superadmin'));
app.use('/api/pos', require('./src/routes/pos'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/app-config', (req, res) => {
  try {
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'src/config/app-config.json'), 'utf8'));
    res.json({ posEnabled: !!config.posEnabled });
  } catch { res.json({ posEnabled: true }); }
});

const { requireAuth: requireAuthConfig } = require('./src/middleware/auth');
app.get('/api/config', requireAuthConfig, (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
});

const sendPage = (file) => (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', file));
};
app.get('/booking', sendPage('booking.html'));
app.get('/kasir', sendPage('kasir.html'));
app.get('/admin', sendPage('admin.html'));
app.get('/barber', sendPage('barber.html'));
app.get('/login', sendPage('login.html'));
app.get('/log', sendPage('log.html'));
app.get('/pos', sendPage('pos.html'));

app.listen(PORT, () => {
  console.log(`LUMENS HAIR STUDIO running on port ${PORT}`);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

# SOP Pembuatan Web Application
> Referensi praktis berdasarkan pengalaman membangun TraderX.id — dari 0 ke produksi dalam satu bulan.

---

## Daftar Isi
1. [Filosofi & Prinsip Dasar](#1-filosofi--prinsip-dasar)
2. [Tech Stack Framework](#2-tech-stack-framework)
3. [Struktur Proyek](#3-struktur-proyek)
4. [Fase Development](#4-fase-development)
5. [Clean Code Guidelines](#5-clean-code-guidelines)
6. [Database Best Practices](#6-database-best-practices)
7. [Backend Best Practices](#7-backend-best-practices)
8. [Frontend Best Practices](#8-frontend-best-practices)
9. [Security Checklist (OWASP)](#9-security-checklist-owasp)
10. [Testing Strategy](#10-testing-strategy)
11. [Deployment & DevOps](#11-deployment--devops)
12. [Problem Solving Patterns](#12-problem-solving-patterns)
13. [Checklist Final Sebelum Launch](#13-checklist-final-sebelum-launch)

---

## 1. Filosofi & Prinsip Dasar

### Ship Fast, Fix Real
- Bangun yang benar-benar dibutuhkan sekarang, bukan yang mungkin dibutuhkan nanti
- Tiga baris serupa lebih baik dari abstraksi prematur
- Tidak ada fitur setengah jadi — selesaikan atau jangan mulai

### Keputusan Berdampak Luas
Sebelum bertindak, tanya:
- **Reversible?** Jika tidak, konfirmasi dulu
- **Blast radius?** Seberapa banyak yang terdampak jika salah
- **Shared state?** Apakah ini memengaruhi user lain / production

### Prioritas Dalam Order
1. Keamanan (data user, uang)
2. Kebenaran (logika benar)
3. Performa
4. Keterbacaan kode
5. Estetika

---

## 2. Tech Stack Framework

### Stack Rekomendasi (Proven)
```
Backend  : Node.js + Express
Database : Supabase (PostgreSQL) — managed, gratis tier bagus
Auth     : JWT → httpOnly Cookie (BUKAN localStorage)
Frontend : Vanilla JS SPA atau Next.js / Nuxt
Deploy   : Railway (auto-deploy dari GitHub, murah)
Email    : Nodemailer + SMTP (Gmail/Zoho)
Testing  : Playwright (E2E)
```

### Kapan Gunakan Apa
| Kebutuhan | Pilihan |
|---|---|
| CRUD sederhana | Express + Supabase langsung |
| Realtime | Supabase Realtime / WebSocket |
| File upload | Supabase Storage atau Cloudinary |
| Jadwal/cron | `node-cron` di backend |
| Push notif | Web Push API + VAPID keys |
| Payment | Duitku (IDR, mudah verifikasi merchant) |
| CDN font/icon | Font Awesome (cdnjs), Google Fonts |

### Environment Variables — Wajib Ada
```env
# App
NODE_ENV=production
PORT=3002
APP_URL=https://yourdomain.com

# Database
SUPABASE_URL=
SUPABASE_ANON_KEY=          # frontend-safe (RLS required)
SUPABASE_SERVICE_ROLE_KEY=  # backend only, JANGAN expose ke frontend

# Auth
JWT_SECRET=                 # min 32 char, random

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Payment
PAYMENT_MERCHANT_CODE=
PAYMENT_API_KEY=
PAYMENT_IS_PRODUCTION=false  # false = sandbox
```

---

## 3. Struktur Proyek

### Layout Standar
```
project-root/
│
├── server.js                 # Entry point — setup Express, middleware, mount routes
│
├── src/
│   ├── routes/               # Satu file per domain fitur
│   │   ├── auth.js           # /api/auth/*
│   │   ├── users.js          # /api/users/*
│   │   ├── admin.js          # /api/admin/*
│   │   └── payments.js       # /api/payments/*
│   ├── middleware/
│   │   └── auth.js           # requireAuth, requireAdmin
│   ├── db.js                 # Semua fungsi database (single source of truth)
│   ├── cache.js              # In-memory cache helper
│   ├── email.js              # Email templates & send functions
│   ├── config.js             # Constants, harga, plan levels
│   └── [service].js          # Satu file per service (backup, tracker, dll)
│
├── public/                   # Static files — served langsung
│   ├── index.html            # Landing page
│   ├── app.html              # SPA utama
│   ├── Login.html            # Halaman auth
│   ├── css/
│   │   ├── style.css         # Global styles
│   │   └── app.css           # App-specific styles
│   ├── js/
│   │   ├── core.js           # Auth, API helpers
│   │   ├── [feature].js      # Satu file per fitur
│   │   └── init.js           # App bootstrap
│   ├── Assets/
│   │   └── Logos/            # Logo SVG, PNG berbagai ukuran
│   ├── sw.js                 # Service Worker (PWA)
│   └── manifest.json         # PWA manifest
│
├── scripts/
│   ├── schema.sql            # DDL — semua tabel database
│   ├── migrate.js            # Migration script
│   └── cleanup_test_users.js # Utility scripts
│
├── tests/
│   ├── helpers.js            # injectAuthSession, generateToken
│   └── [feature].spec.js    # Satu file spec per domain
│
├── docs/
│   ├── admin.md              # Panduan admin
│   └── prompts/              # AI prompts terpisah
│
├── .env                      # JANGAN commit ke git
├── .env.example              # Template — commit ini
├── .gitignore
├── package.json
├── railway.json              # Config deployment
└── playwright.config.js
```

### .gitignore Wajib
```
node_modules/
.env
*.log
.DS_Store
Thumbs.db
test-results/
playwright-report/
scratch/
*.bak
```

---

## 4. Fase Development

### Fase 1 — Foundation (Minggu 1)
- [ ] Setup project structure
- [ ] Environment variables
- [ ] Database schema (schema.sql)
- [ ] Auth system (register, login, logout) dengan httpOnly cookie
- [ ] Middleware `requireAuth` dan `requireAdmin`
- [ ] Static file serving
- [ ] Deploy ke Railway (CI/CD otomatis dari push)

### Fase 2 — Core Features (Minggu 2-3)
- [ ] CRUD utama sesuai domain bisnis
- [ ] Admin panel dasar
- [ ] Email sistem (welcome, notifikasi)
- [ ] Rate limiting

### Fase 3 — Growth Features (Minggu 3-4)
- [ ] Payment integration
- [ ] PWA (manifest + service worker)
- [ ] SEO (OG tags, sitemap, robots.txt)
- [ ] Analytics / monitoring

### Fase 4 — Hardening (Sebelum Launch)
- [ ] Security audit (OWASP checklist)
- [ ] E2E tests
- [ ] Performance optimization
- [ ] Backup strategy

---

## 5. Clean Code Guidelines

### Penamaan
```js
// BAD
const d = await db.get(u);
function proc(x) { ... }

// GOOD
const user = await db.getUserByUsername(username);
function processPaymentApproval(paymentId) { ... }
```

### Fungsi
- Satu fungsi, satu tanggung jawab
- Jika butuh scroll untuk baca satu fungsi → pecah
- Parameter > 3 → gunakan object `{ id, plan, expired }`

### Komentar — Hanya Jika WHY Tidak Obvious
```js
// BAD — menjelaskan WHAT (sudah jelas dari kode)
// Ambil user dari database
const user = await getUserByUsername(username);

// GOOD — menjelaskan WHY (constraint tersembunyi)
// Supabase default limit 1000 baris — gunakan paginated helper untuk tabel besar
const trades = await getTrades(username, { paginated: true });
```

### Constants, Bukan Magic Numbers
```js
// BAD
if (user.plan_level >= 2) { ... }
setTimeout(fn, 3600000);

// GOOD
const PLAN = { BASIC: 0, PRO: 1, ELITE: 2 };
const ONE_HOUR_MS = 60 * 60 * 1000;

if (user.plan_level >= PLAN.ELITE) { ... }
setTimeout(fn, ONE_HOUR_MS);
```

### Hindari
- `innerHTML` dengan data user (XSS) → gunakan `textContent` atau `esc()` helper
- `console.log` di production (kebocoran info)
- Hardcode nilai yang bisa berubah (harga, URL, email)
- Nested callback lebih dari 2 level → async/await

---

## 6. Database Best Practices

### Schema — Konvensi
```sql
-- Selalu ada kolom audit
created_at  TIMESTAMPTZ DEFAULT now()
updated_at  TIMESTAMPTZ DEFAULT now()

-- Soft delete (opsional, tapi lebih aman)
deleted_at  TIMESTAMPTZ DEFAULT NULL

-- Username selalu lowercase di DB
username    TEXT REFERENCES users(username)  -- lowercase constraint
```

### Supabase Spesifik
```js
// MASALAH: Default limit 1000 baris — sering terlupa!
// Selalu gunakan .range() untuk tabel besar
const { data } = await supabase
  .from('trades')
  .select('*')
  .eq('username', username)
  .range(0, 999);  // atau loop dengan pagination

// Service Role Key untuk operasi server-side
// JANGAN gunakan anon key untuk operasi admin
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

### Row Level Security (RLS) — WAJIB di Supabase
```sql
-- Enable RLS pada semua tabel
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Policy: user hanya bisa akses data sendiri
CREATE POLICY "users_own_data" ON trades
  FOR ALL USING (auth.uid() = user_id);
```

### Cache Pattern
```js
// In-memory cache untuk kurangi DB calls
const CACHE_TTL = 30; // detik

async function getUserByUsername(username, { fresh = false } = {}) {
  const cacheKey = `user:${username}`;
  if (!fresh) {
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached;
  }
  const user = await db.query(...);
  cacheSet(cacheKey, user, CACHE_TTL);
  return user;
}

// PENTING: Invalidate cache saat data berubah
async function updateUser(username, data) {
  cacheDel(`user:${username}`);  // invalidate SEBELUM update
  return await db.update(...);
}
```

---

## 7. Backend Best Practices

### server.js — Setup Standar
```js
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const app = express();

// Trust proxy (wajib untuk Railway/Heroku)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://*.supabase.co'],
      // PENTING: SW fetch() diatur oleh connect-src, bukan style/script-src
      // Tambahkan semua CDN yang digunakan ke connect-src juga
    }
  }
}));

app.use(compression());  // gzip
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Rate limiting — SELALU skip localhost untuk tests
const isLocalhost = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 150,
  skip: isLocalhost
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: isLocalhost,
  message: { success: false, message: 'Terlalu banyak percobaan. Coba lagi nanti.' }
});
```

### Auth Middleware Pattern
```js
// src/middleware/auth.js
function requireAuth(req, res, next) {
  const token = req.cookies.session_token;
  if (!token) return res.status(401).json({ success: false, message: 'Login required' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.clearCookie('session_token');
    return res.status(401).json({ success: false, message: 'Session expired' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Forbidden' });
    next();
  });
}
```

### Cookie Auth — Cara Benar
```js
// Login — set httpOnly cookie
const token = jwt.sign({ username, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const cookieOpts = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',  // HTTPS only di prod
  maxAge: 7 * 24 * 60 * 60 * 1000
};
res.cookie('session_token', token, cookieOpts);

// Logout — clearCookie HARUS pakai opsi yang sama
res.clearCookie('session_token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
```

### Route Error Handling
```js
// Wrap semua route dengan try/catch
router.get('/data', requireAuth, async (req, res) => {
  try {
    const data = await getData(req.user.username);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[/data]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
    // JANGAN expose err.message ke client di production
  }
});
```

---

## 8. Frontend Best Practices

### XSS Prevention — Wajib
```js
// Helper — selalu ada di codebase
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

// BAD — XSS vulnerability
element.innerHTML = `<span>${userData}</span>`;

// GOOD
element.innerHTML = `<span>${esc(userData)}</span>`;

// ATAU lebih baik
element.textContent = userData;
```

### API Helper Pattern
```js
// Satu fungsi API call untuk semua request
async function apiGet(endpoint) {
  const res = await fetch(endpoint, { credentials: 'include' });  // kirim cookie
  if (!res.ok) throw new Error(`${res.status} ${endpoint}`);
  return res.json();
}

async function apiPost(endpoint, body) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  return res.json();
}
```

### Service Worker — Jangan Intercept CDN
```js
// sw.js — PENTING: skip cross-origin request
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;
  if (!e.request.url.startsWith(self.location.origin)) return;  // skip CDN!
  
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
```
> **Kenapa?** SW menggunakan `connect-src` CSP miliknya sendiri, bukan `style-src`/`script-src`. Jika CDN tidak ada di `connect-src`, SW akan memblokir request bahkan jika domain ada di `styleSrc`.

### i18n Pattern (Sederhana, Tanpa Library)
```js
const STRINGS = {
  id: { 'nav.home': 'Beranda', 'btn.login': 'Masuk' },
  en: { 'nav.home': 'Home', 'btn.login': 'Login' }
};

function applyLang(lang) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (STRINGS[lang]?.[key]) el.textContent = STRINGS[lang][key];
  });
  // untuk HTML content gunakan data-i18n-html
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    if (STRINGS[lang]?.[key]) el.innerHTML = STRINGS[lang][key];  // pastikan value aman!
  });
}
```

### PWA Manifest Minimal
```json
{
  "name": "NamaApp",
  "short_name": "App",
  "start_url": "/app",
  "display": "standalone",
  "background_color": "#07070f",
  "theme_color": "#07070f",
  "icons": [
    { "src": "/Assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/Assets/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 9. Security Checklist (OWASP)

### A01 — Broken Access Control
- [ ] Setiap route yang butuh login → ada `requireAuth` middleware
- [ ] Setiap route admin → ada `requireAdmin` middleware
- [ ] User tidak bisa akses data user lain (filter by `req.user.username`)
- [ ] Supabase RLS diaktifkan di semua tabel

### A02 — Cryptographic Failures
- [ ] Password di-hash dengan bcrypt (cost factor ≥ 10)
- [ ] JWT secret min 32 karakter, disimpan di env var
- [ ] Token sensitif TIDAK ada di URL atau localStorage
- [ ] Cookie: `httpOnly: true`, `secure: true` (prod), `sameSite: 'strict'`

### A03 — Injection / XSS
- [ ] Semua output user ke DOM pakai `textContent` atau `esc()` helper
- [ ] Tidak ada `innerHTML = userData` tanpa sanitasi
- [ ] Supabase parameterized queries (otomatis aman, tidak raw SQL)
- [ ] CSP header dikonfigurasi via Helmet

### A04 — Insecure Design
- [ ] Rate limiting di endpoint auth (login, register, password reset)
- [ ] Rate limiting di endpoint yang mahal (payment, bulk operations)
- [ ] Payment amount divalidasi di server, bukan dari client

### A05 — Security Misconfiguration
- [ ] `NODE_ENV=production` di production
- [ ] Error message tidak expose stack trace ke client
- [ ] CORS hanya izinkan domain sendiri
- [ ] CSP `connect-src` mencakup semua CDN yang digunakan (termasuk untuk SW)
- [ ] Debug endpoints dihapus sebelum launch

### A06 — Vulnerable Components
```bash
# Jalankan secara berkala
npm audit

# Fix otomatis
npm audit fix

# Force update package tertentu
npm install axios@latest

# Override nested dependency
# package.json
"overrides": { "axios": "^1.18.0" }
```

### A07 — Auth Failures
- [ ] Tidak ada session yang tidak pernah expire
- [ ] Logout benar-benar menghapus cookie (clearCookie dengan opsi lengkap)
- [ ] Password reset token expire dalam 1 jam

### A09 — Logging
- [ ] Tidak ada password/token yang di-log
- [ ] Ada audit trail untuk operasi finansial
- [ ] Error di-log di server, bukan di-expose ke client

---

## 10. Testing Strategy

### Playwright E2E — Setup
```js
// playwright.config.js
module.exports = {
  testDir: './tests',
  workers: 1,           // sequential — penting untuk DB state
  use: {
    baseURL: 'http://localhost:3002',
    headless: true
  }
};
```

### Helper Pattern — Auth Injection
```js
// tests/helpers.js
async function injectAuthSession(context, { username, role, plan, expired }) {
  // Pastikan user ada di DB (createUser jika belum)
  let user = await db.getUserByUsername(username);
  if (!user) {
    await db.createUser({ username, role, plan, expired, ... });
  } else {
    await db.updateUser(username, { role, plan, expired });
  }

  // Set cookie langsung tanpa lewat login form
  const token = jwt.sign({ username, role }, process.env.JWT_SECRET);
  await context.addCookies([{
    name: 'session_token', value: token,
    domain: 'localhost', path: '/'
  }]);
  
  return token;
}
```

### Pola Test yang Baik
```js
test.describe('Feature X', () => {
  test.beforeEach(async ({ context }) => {
    // Inject auth — hindari test bergantung pada login form
    await injectAuthSession(context, { username: 'test_user', role: 'user' });
  });

  test.afterEach(async () => {
    // Cleanup — hapus data test dari DB
    await db.deleteUser('test_user');
  });

  test('should do X when Y', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('#element')).toBeVisible();
  });
});
```

### Cache Gotcha di Tests
```js
// Server dan test process punya cache instance BERBEDA
// Setelah update via API, baca DB langsung dengan fresh:true
const user = await db.getUserByUsername('test_user', { fresh: true });
expect(user.plan).toBe('Pro');
```

### Cleanup Script
```js
// scripts/cleanup_test_users.js
// Jalankan sebelum dan setelah test suite
// Jangan masukkan user production ke list ini!
const TEST_USERS = ['test_user_1', 'test_user_2', ...];
```

---

## 11. Deployment & DevOps

### Railway Setup
```json
// railway.json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "nixpacks" },
  "deploy": {
    "startCommand": "node server.js",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "always"
  }
}
```

### Health Endpoint — Wajib Ada
```js
app.get('/api/health', async (req, res) => {
  try {
    await supabase.from('users').select('count').limit(1);
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});
```

### Monitoring & Alerting
```js
// Crash handler — kirim notif ke Telegram/email
process.on('uncaughtException', async (err) => {
  console.error('[CRASH]', err);
  await sendTelegramAlert(`🔴 Server crash: ${err.message}`);
  process.exit(1);  // Railway akan auto-restart
});
```

### Backup Strategy
```js
// Backup otomatis harian — export data penting
async function dailyBackup() {
  const data = await supabase.from('users').select('*');
  const csv = convertToCSV(data);
  await sendEmail({ to: 'admin@domain.com', subject: 'Daily Backup', attachment: csv });
}

// Jadwalkan dengan node-cron
cron.schedule('0 2 * * *', dailyBackup);  // jam 2 pagi tiap hari
```

### Git Workflow
```bash
# Setiap fitur dalam commit terpisah dengan pesan jelas
git commit -m "feat: tambah export PDF laporan bulanan (Elite only)"
git commit -m "fix: rate limit 429 pada tests — skip localhost"
git commit -m "security: XSS escape di innerHTML online users"
git commit -m "chore: reorganisasi struktur — schema.sql ke scripts/"

# Format pesan commit
# feat:     fitur baru
# fix:      perbaikan bug
# security: perbaikan keamanan
# chore:    maintenance, cleanup
# refactor: refactoring tanpa perubahan fungsi
# perf:     improvement performa
# test:     penambahan/perbaikan tests
# docs:     dokumentasi
```

---

## 12. Problem Solving Patterns

### 1. CSP Blocking External Resources
**Symptom**: Icon tidak muncul, font tidak load, chart tidak tampil  
**Cek**: Browser DevTools → Console → error "Content Security Policy"  
**Fix**:
```js
// Tambahkan domain ke directive yang tepat
// INGAT: SW fetch() diatur oleh connect-src, bukan style/script-src
connectSrc: ["'self'", 
  'https://cdnjs.cloudflare.com',   // Font Awesome
  'https://cdn.jsdelivr.net',        // Chart.js, dll
  'https://fonts.googleapis.com',    // Google Fonts
]
// Setelah ubah server.js → restart server → hard refresh (Ctrl+Shift+R)
```

### 2. Stale Cache Setelah DB Update
**Symptom**: Data di DB sudah berubah tapi aplikasi masih tampilkan data lama  
**Cause**: In-memory cache di server belum di-invalidate  
**Fix**:
```js
// Pattern: invalidate SEBELUM atau SESAAT SETELAH write
async function updateUser(username, data) {
  cacheDel(`user:${username}`);          // invalidate dulu
  const result = await db.update(...);
  return result;
}

// Untuk createUser — cache mungkin menyimpan null
async function createUser(userData) {
  cacheDel(`user:${userData.username}`); // hapus null cache
  return await db.insert(...);
}
```

### 3. Supabase 1000-Row Limit
**Symptom**: Data hanya muncul sebagian, statistik tidak akurat  
**Cause**: Supabase default limit 1000 baris per query  
**Fix**:
```js
// Loop dengan pagination
async function getAllTrades(username) {
  let all = [], from = 0;
  while (true) {
    const { data } = await supabase
      .from('trades').select('*')
      .eq('username', username)
      .range(from, from + 999);
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}
```

### 4. Test Flaky Karena Timing
**Symptom**: Test kadang pass, kadang fail tanpa perubahan kode  
**Cause**: Cold start, slow DB response, race condition  
**Fix**:
```js
// Beri waktu untuk DB settle setelah action
await page.click('#btn-approve');
await page.waitForResponse('**/api/admin/approve');  // lebih baik dari waitForTimeout
// ATAU
await expect(page.locator('#success-msg')).toBeVisible({ timeout: 10000 });
```

### 5. Rate Limit 429 Pada Tests
**Symptom**: Test gagal dengan status 429  
**Fix**:
```js
// Di server.js — skip rate limit untuk localhost
const isLocalhost = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);
const limiter = rateLimit({ ..., skip: isLocalhost });
```

### 6. Service Worker Cache Stale
**Symptom**: Perubahan di server tidak terlihat di browser  
**Fix**:
1. DevTools → Application → Service Workers → Unregister
2. Hard refresh: Ctrl+Shift+R
3. Atau update CACHE version di sw.js: `const CACHE = 'app-v3';`

### 7. Foreign Key Constraint Gagal Diam-Diam
**Symptom**: Insert berhasil (tidak error) tapi data tidak tersimpan  
**Cause**: FK constraint violation — referenced row tidak ada  
**Fix**: Pastikan parent record ada sebelum insert child
```js
// Contoh: events table FK ke users(username)
// Jika user tidak ada di DB → logEvent() gagal silent
// Selalu pastikan user ada sebelum insert event
```

### 8. Encoding Corruption di HTML
**Symptom**: Karakter aneh muncul (`â€"`, `â—Â`, dll) menggantikan emoji/simbol  
**Cause**: File di-edit dengan encoding salah (Windows-1252 bukan UTF-8)  
**Fix**: Simpan file dengan `UTF-8 without BOM` di editor. Di PowerShell, hindari `Set-Content` untuk file HTML — gunakan Node.js script atau editor yang tepat.

---

## 13. Checklist Final Sebelum Launch

### Security
- [ ] `NODE_ENV=production` di Railway environment vars
- [ ] Semua secret di env vars, tidak ada yang hardcode
- [ ] RLS diaktifkan di Supabase
- [ ] `npm audit` — tidak ada high/critical vulnerability
- [ ] Rate limiting aktif di semua endpoint sensitif
- [ ] Error response tidak expose stack trace

### Functionality
- [ ] Register → Login → Logout flow berjalan
- [ ] Payment flow (sandbox) berjalan end-to-end
- [ ] Email terkirim (welcome, notifikasi)
- [ ] Mobile responsive di semua halaman utama
- [ ] Light/dark mode berfungsi

### Performance
- [ ] Gzip/compression aktif
- [ ] Cache header untuk static assets
- [ ] Pagination untuk data besar (> 1000 rows)
- [ ] Font & CDN loading tidak diblokir CSP

### SEO & Discovery
- [ ] `<title>` dan `<meta description>` unik tiap halaman
- [ ] OG tags untuk social sharing
- [ ] `sitemap.xml` dan `robots.txt` ada
- [ ] Google Search Console terdaftar

### Operations
- [ ] `/api/health` endpoint berfungsi
- [ ] Monitoring/alerting ada (Telegram/email saat crash)
- [ ] Backup otomatis terjadwal
- [ ] Runbook: cara restart, rollback, restore backup

### Testing
- [ ] E2E tests pass semua
- [ ] Test users sudah dihapus dari database
- [ ] Manual test golden path di device nyata (HP + desktop)

---

## Appendix — Snippets Berguna

### Bcrypt Hash Password
```js
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash(password, 12);
const valid = await bcrypt.compare(inputPassword, storedHash);
```

### JWT dengan Expiry
```js
const jwt = require('jsonwebtoken');
const token = jwt.sign({ username, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const payload = jwt.verify(token, process.env.JWT_SECRET);  // throws jika expired
```

### node-cron Schedule
```js
const cron = require('node-cron');
cron.schedule('0 8 * * 1', weeklyReport);   // Senin jam 8 pagi
cron.schedule('0 2 * * *', dailyBackup);    // Tiap hari jam 2 pagi
cron.schedule('*/30 * * * *', pingCheck);   // Tiap 30 menit
```

### Nodemailer Config
```js
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  pool: true,              // connection pooling
  maxConnections: 3,
  socketTimeout: 15000     // 15s timeout, bukan default infinite
});
```

### Supabase Client (Server-side)
```js
const { createClient } = require('@supabase/supabase-js');

// Untuk operasi server-side (bypass RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // bukan ANON KEY
);
```

---

*Dokumen ini dibuat berdasarkan pengalaman langsung membangun TraderX.id — platform jurnal trading untuk trader Indonesia. Update terakhir: Juni 2026.*

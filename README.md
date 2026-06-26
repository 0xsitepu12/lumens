# LUMEN'S STUDIO

Sistem booking online & POS untuk LUMEN'S STUDIO — hair & styling studio di Medan.

**Live:** [lumnstudio.online](https://lumnstudio.online)

## Fitur

### Booking Online
- Pilih layanan, stylist, tanggal, dan waktu
- Slot otomatis berdasarkan jadwal & durasi layanan
- Konfirmasi via WhatsApp
- PWA — bisa di-install ke homescreen

### Kasir Dashboard
- **Booking tab** — week calendar, summary, daftar booking, walk-in
- **POS tab (Beta)** — point of sale terintegrasi
- **Riwayat tab** — riwayat transaksi POS + omset
- Realtime update (Supabase websocket)
- Notifikasi suara booking baru
- Block jam walk-in sebelum jam buka (09:00)
- Titik indikator orderan pada kalender

### POS (Point of Sale)
- Pilih stylist → layanan → produk (minuman dll)
- Barber opsional untuk pembelian produk saja
- Metode bayar: Cash / Transfer / QRIS
- Hitung kembalian otomatis
- Struk digital via WhatsApp
- Stok produk otomatis berkurang
- Riwayat transaksi + refund (admin only)
- Toggle on/off dari admin

### Barber Dashboard
- Week strip calendar + quick filter (Hari/Minggu/Bulan/Total)
- Pendapatan bersih per bulan
- Atur jadwal sendiri (shift & hari libur)
- Ubah password

### Admin Panel
- **Dashboard** — analytics: revenue, peak hours, peak days, performa barber
- **Booking** — kelola booking, filter periode + custom date range picker, grouped per bulan
- **Kalender** — kalender PnL pendapatan per tanggal (warna berdasarkan performa)
- **Layanan** — CRUD layanan + harga modal
- **Barber** — kelola barber, jadwal, password
- **Produk** — CRUD produk (minuman dll), stok, icon picker, harga modal
- **Pengaturan** — sub-tabs:
  - Umum: POS toggle, jam operasional
  - Akun: kelola staff, ubah password, buat kasir
  - Keamanan: password reset, danger zone
- Export data ke Excel (bookings, services, revenue)
- Dashboard filter periode (Hari Ini/Minggu Ini/Bulan Ini/Custom)
- Grafik pendapatan per jam (bar chart) saat filter Hari Ini

## Security

- Helmet CSP
- Rate limiting (global + auth + booking create)
- XSS protection (`esc()` + `escAttr()`)
- JWT httpOnly cookie dengan barberId
- Role-based access: `requireAuth`, `requireKasir`, `requireAdmin`
- POS harga divalidasi server-side dari DB (anti-tamper)
- Public booking tidak bisa override harga/durasi
- Refund hanya oleh admin
- `/api/config` memerlukan autentikasi
- `/api/auth/setup` disabled di production
- JSON body limit 100KB

## Tech Stack

| Layer | Tech |
|-------|------|
| Server | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime (websocket) |
| Auth | JWT + httpOnly cookie |
| Frontend | Vanilla JS, CSS custom |
| Charts | Chart.js |
| Testing | Playwright |
| Deploy | Railway + Nixpacks |
| PWA | Service Worker + Web Manifest |

## Struktur

```
├── server.js              # Express server
├── src/
│   ├── config.js           # Constants, timezone helpers
│   ├── db.js               # Supabase client & queries
│   ├── middleware/auth.js   # JWT auth + role middleware
│   └── routes/
│       ├── auth.js          # Login, logout, setup
│       ├── bookings.js      # Booking CRUD + kasir endpoints
│       ├── admin.js         # Admin dashboard & management
│       ├── barber.js        # Barber dashboard & schedule
│       ├── pos.js           # POS transactions, products, refund
│       └── superadmin.js    # Superadmin routes
├── public/
│   ├── css/style.css        # Main stylesheet
│   ├── js/
│   │   ├── core.js          # Shared utilities, SW register
│   │   ├── booking.js       # Booking wizard
│   │   ├── kasir.js         # Kasir + tab switching
│   │   ├── pos.js           # POS module (IIFE)
│   │   ├── barber.js        # Barber dashboard
│   │   └── admin.js         # Admin panel
│   ├── index.html           # Landing page
│   ├── booking.html         # Booking page
│   ├── kasir.html           # Kasir (Booking + POS + Riwayat)
│   ├── pos.html             # POS standalone (legacy)
│   ├── barber.html          # Barber dashboard
│   ├── admin.html           # Admin panel
│   ├── login.html           # Login page
│   ├── sw.js                # Service Worker
│   └── manifest.json        # PWA manifest
├── sql/
│   └── pos-tables.sql       # POS database migration
├── scripts/
│   └── schema.sql           # Main database schema
├── tests/
│   └── pos.spec.js          # Playwright POS tests
└── railway.json             # Railway deploy config
```

## Setup

```bash
cp .env.example .env
# Isi SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, SUPABASE_ANON_KEY

npm install
npm start
# http://localhost:3003
```

### Database Setup

1. Jalankan `scripts/schema.sql` di Supabase SQL Editor
2. Jalankan `sql/pos-tables.sql` untuk tabel POS
3. Tambah kolom: `ALTER TABLE products ADD COLUMN IF NOT EXISTS modal_price INTEGER DEFAULT 0;`

### Testing

```bash
npx playwright install chromium
npx playwright test
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key (realtime) |
| `JWT_SECRET` | Yes | Min 32 chars |
| `NODE_ENV` | No | `production` untuk deploy |
| `PORT` | No | Default 3003 |

## Timezone

Semua date/time menggunakan **WIB (Asia/Jakarta)** via helper `todayWIB()` dan `nowWIB()`.

---

Built for LUMEN'S STUDIO, Jl. Laksana No. 28A, Kota Medan.

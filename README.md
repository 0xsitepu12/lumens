# LUMEN'S STUDIO

Sistem booking online untuk LUMEN'S STUDIO — hair & styling studio di Medan.

**Live:** [lumnstudio.online](https://lumnstudio.online)

## Fitur

### Booking Online
- Pilih layanan (multi-select), stylist, tanggal, dan waktu
- Slot otomatis berdasarkan jadwal & durasi layanan
- Konfirmasi via WhatsApp
- PWA — bisa di-install ke homescreen

### Kasir Dashboard
- Week strip calendar — navigasi per minggu
- Realtime update (Supabase websocket)
- Walk-in booking — jam bebas tanpa validasi slot
- Omset harian otomatis
- Notifikasi suara booking baru

### Barber Dashboard
- Week strip calendar + quick filter (Hari/Minggu/Bulan/Total)
- Pendapatan bersih & omset
- Grafik pendapatan (Chart.js)
- Atur jadwal sendiri (shift & hari libur)
- Ubah password

### Admin Panel
- Dashboard analytics: revenue, peak hours, peak days
- Kelola layanan, barber, jadwal, operating hours
- Kelola staff (kasir & barber accounts)
- Export data ke Excel (bookings, services, revenue)
- Reset data booking

## Tech Stack

| Layer | Tech |
|-------|------|
| Server | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime (websocket) |
| Auth | JWT + httpOnly cookie |
| Frontend | Vanilla JS, CSS custom |
| Deploy | Railway + Nixpacks |
| PWA | Service Worker + Web Manifest |

## Struktur

```
├── server.js              # Express server
├── src/
│   ├── config.js           # Constants, timezone helpers
│   ├── db.js               # Supabase client & queries
│   ├── middleware/auth.js   # JWT auth middleware
│   └── routes/
│       ├── auth.js          # Login, logout, setup
│       ├── bookings.js      # Booking CRUD + kasir
│       ├── admin.js         # Admin dashboard & management
│       └── barber.js        # Barber dashboard & schedule
├── public/
│   ├── css/style.css        # Main stylesheet
│   ├── js/
│   │   ├── core.js          # Shared utilities, SW register
│   │   ├── booking.js       # Booking wizard
│   │   ├── kasir.js         # Kasir dashboard
│   │   ├── barber.js        # Barber dashboard
│   │   └── admin.js         # Admin panel
│   ├── index.html           # Landing page
│   ├── booking.html         # Booking page
│   ├── kasir.html           # Kasir page
│   ├── barber.html          # Barber dashboard
│   ├── admin.html           # Admin panel
│   ├── login.html           # Login page
│   ├── sw.js                # Service Worker
│   └── manifest.json        # PWA manifest
└── railway.json             # Railway deploy config
```

## Setup

```bash
cp .env.example .env
# Isi SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET

npm install
npm start
# http://localhost:3003
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

## Security

- Helmet CSP
- Rate limiting (global + auth + booking create)
- XSS protection (`esc()` + `escAttr()`)
- JWT httpOnly cookie
- `/api/auth/setup` disabled di production
- JSON body limit 100KB

---

Built for LUMEN'S STUDIO, Jl. Laksana No. 28A, Kota Medan.

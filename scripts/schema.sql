-- LUMENS HAIR STUDIO - Database Schema
-- Jalankan di Supabase SQL Editor

-- ============================================
-- USERS (admin & barber accounts)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'barber' CHECK (role IN ('admin', 'barber')),
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SERVICES (layanan potong, dll)
-- ============================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 30,
  price INT NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'haircut',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- BARBERS (data barber/kapster)
-- ============================================
CREATE TABLE IF NOT EXISTS barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  speciality TEXT,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- BOOKINGS (reservasi pelanggan)
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  service_id UUID REFERENCES services(id),
  barber_id UUID REFERENCES barbers(id),
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INT NOT NULL,
  total_price INT NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- OPERATING HOURS (jam operasional)
-- ============================================
CREATE TABLE IF NOT EXISTS operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '21:00',
  is_closed BOOLEAN DEFAULT false,
  UNIQUE(day_of_week)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_barber ON bookings(barber_id);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Default operating hours (Senin-Sabtu 09:00-21:00, Minggu tutup)
INSERT INTO operating_hours (day_of_week, open_time, close_time, is_closed) VALUES
  (0, '09:00', '21:00', true),   -- Minggu (tutup)
  (1, '09:00', '21:00', false),  -- Senin
  (2, '09:00', '21:00', false),  -- Selasa
  (3, '09:00', '21:00', false),  -- Rabu
  (4, '09:00', '21:00', false),  -- Kamis
  (5, '09:00', '21:00', false),  -- Jumat
  (6, '09:00', '21:00', false)   -- Sabtu
ON CONFLICT (day_of_week) DO NOTHING;

-- Default services
INSERT INTO services (name, description, duration_minutes, price, category, sort_order) VALUES
  ('Haircut Regular', 'Potong rambut standar profesional', 30, 50000, 'haircut', 1),
  ('Haircut Premium', 'Potong rambut + styling premium', 45, 80000, 'haircut', 2),
  ('Shaving', 'Cukur jenggot & kumis', 20, 35000, 'shaving', 3),
  ('Hair Wash', 'Cuci rambut + massage kepala', 20, 30000, 'treatment', 4),
  ('Hair Coloring', 'Pewarnaan rambut profesional', 90, 150000, 'coloring', 5),
  ('Kids Haircut', 'Potong rambut anak (< 12 tahun)', 25, 40000, 'haircut', 6),
  ('Beard Trim', 'Rapikan jenggot & bentuk', 15, 25000, 'shaving', 7),
  ('Full Package', 'Haircut + Shaving + Hair Wash', 60, 100000, 'package', 8)
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE operating_hours ENABLE ROW LEVEL SECURITY;

-- Service role bypass (untuk backend)
CREATE POLICY "service_role_all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON barbers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON operating_hours FOR ALL USING (true) WITH CHECK (true);

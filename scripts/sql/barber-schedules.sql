-- Barber Schedules — jadwal per barber per hari
-- Jalankan di Supabase SQL Editor SETELAH schema.sql

CREATE TABLE IF NOT EXISTS barber_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  is_off BOOLEAN DEFAULT false,
  UNIQUE(barber_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_barber_schedules_barber ON barber_schedules(barber_id);
CREATE INDEX IF NOT EXISTS idx_barber_schedules_day ON barber_schedules(day_of_week);

ALTER TABLE barber_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON barber_schedules FOR ALL USING (true) WITH CHECK (true);

-- Prevent overlapping bookings at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_double_booking
  ON bookings(barber_id, booking_date, booking_time)
  WHERE status NOT IN ('cancelled');

-- ============================================
-- SCHEDULE DATA
-- ============================================
-- Eybay (manager, flexible — available every day 10:00-20:30)
INSERT INTO barber_schedules (barber_id, day_of_week, shift_start, shift_end, is_off) VALUES
  ('e271ca09-f46f-4283-a9b7-baebd944433b', 0, '10:00', '20:30', false),
  ('e271ca09-f46f-4283-a9b7-baebd944433b', 1, '10:00', '20:30', false),
  ('e271ca09-f46f-4283-a9b7-baebd944433b', 2, '10:00', '20:30', false),
  ('e271ca09-f46f-4283-a9b7-baebd944433b', 3, '10:00', '20:30', false),
  ('e271ca09-f46f-4283-a9b7-baebd944433b', 4, '10:00', '20:30', false),
  ('e271ca09-f46f-4283-a9b7-baebd944433b', 5, '10:00', '20:30', false),
  ('e271ca09-f46f-4283-a9b7-baebd944433b', 6, '10:00', '20:30', false)
ON CONFLICT (barber_id, day_of_week) DO NOTHING;

-- Fadil
-- Sen=Pagi(10-20), Sel=OFF, Rab=Siang(13-20:30), Kam=Pagi(10-20), Jum=Siang(13-20:30), Sab=Siang(13-20:30), Min=Siang(13-20:30)
INSERT INTO barber_schedules (barber_id, day_of_week, shift_start, shift_end, is_off) VALUES
  ('b26deb59-5199-46c8-8a01-12cb2d3ba394', 0, '13:00', '20:30', false),
  ('b26deb59-5199-46c8-8a01-12cb2d3ba394', 1, '10:00', '20:00', false),
  ('b26deb59-5199-46c8-8a01-12cb2d3ba394', 2, '00:00', '00:00', true),
  ('b26deb59-5199-46c8-8a01-12cb2d3ba394', 3, '13:00', '20:30', false),
  ('b26deb59-5199-46c8-8a01-12cb2d3ba394', 4, '10:00', '20:00', false),
  ('b26deb59-5199-46c8-8a01-12cb2d3ba394', 5, '13:00', '20:30', false),
  ('b26deb59-5199-46c8-8a01-12cb2d3ba394', 6, '13:00', '20:30', false)
ON CONFLICT (barber_id, day_of_week) DO NOTHING;

-- Rifal
-- Sen=Siang(13-20:30), Sel=Pagi(10-20), Rab=OFF, Kam=Siang(13-20:30), Jum=Pagi(10-20), Sab=Siang(13-20:30), Min=Pagi(10-20)
INSERT INTO barber_schedules (barber_id, day_of_week, shift_start, shift_end, is_off) VALUES
  ('4901d347-eca4-4c19-a606-aa1284c49fe6', 0, '10:00', '20:00', false),
  ('4901d347-eca4-4c19-a606-aa1284c49fe6', 1, '13:00', '20:30', false),
  ('4901d347-eca4-4c19-a606-aa1284c49fe6', 2, '10:00', '20:00', false),
  ('4901d347-eca4-4c19-a606-aa1284c49fe6', 3, '00:00', '00:00', true),
  ('4901d347-eca4-4c19-a606-aa1284c49fe6', 4, '13:00', '20:30', false),
  ('4901d347-eca4-4c19-a606-aa1284c49fe6', 5, '10:00', '20:00', false),
  ('4901d347-eca4-4c19-a606-aa1284c49fe6', 6, '13:00', '20:30', false)
ON CONFLICT (barber_id, day_of_week) DO NOTHING;

-- Donald
-- Sen=Siang(13-20:30), Sel=Siang(13-20:30), Rab=Pagi(10-20), Kam=OFF, Jum=Siang(13-20:30), Sab=Pagi(10-20), Min=Siang(13-20:30)
INSERT INTO barber_schedules (barber_id, day_of_week, shift_start, shift_end, is_off) VALUES
  ('064a8c1d-8232-49ff-86eb-54eefa75107b', 0, '13:00', '20:30', false),
  ('064a8c1d-8232-49ff-86eb-54eefa75107b', 1, '13:00', '20:30', false),
  ('064a8c1d-8232-49ff-86eb-54eefa75107b', 2, '13:00', '20:30', false),
  ('064a8c1d-8232-49ff-86eb-54eefa75107b', 3, '10:00', '20:00', false),
  ('064a8c1d-8232-49ff-86eb-54eefa75107b', 4, '00:00', '00:00', true),
  ('064a8c1d-8232-49ff-86eb-54eefa75107b', 5, '13:00', '20:30', false),
  ('064a8c1d-8232-49ff-86eb-54eefa75107b', 6, '10:00', '20:00', false)
ON CONFLICT (barber_id, day_of_week) DO NOTHING;

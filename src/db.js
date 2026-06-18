const { createClient } = require('@supabase/supabase-js');

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi di .env');
    }
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _supabase;
}

const supabase = new Proxy({}, {
  get(_, prop) { return getSupabase()[prop]; }
});

// ============================================
// USERS
// ============================================
async function getUserByUsername(username) {
  const { data } = await supabase.from('users').select('*').eq('username', username).single();
  return data;
}

async function createUser({ username, password_hash, full_name, role, phone, email }) {
  const { data, error } = await supabase.from('users').insert({ username, password_hash, full_name, role, phone, email }).select().single();
  if (error) throw error;
  return data;
}

async function updateUserPassword(username, password_hash) {
  const { error } = await supabase.from('users').update({ password_hash }).eq('username', username);
  if (error) throw error;
}

async function getNonAdminUsers() {
  const { data, error } = await supabase.from('users').select('id, username, full_name, role, is_active').neq('role', 'admin');
  if (error) throw error;
  return data || [];
}

// ============================================
// SERVICES
// ============================================
async function getServices(activeOnly = true) {
  let q = supabase.from('services').select('*').order('sort_order');
  if (activeOnly) q = q.eq('is_active', true);
  const { data } = await q;
  return data || [];
}

async function getServiceById(id) {
  const { data } = await supabase.from('services').select('*').eq('id', id).single();
  return data;
}

async function createService(service) {
  const { data, error } = await supabase.from('services').insert(service).select().single();
  if (error) throw error;
  return data;
}

async function updateService(id, updates) {
  const { data, error } = await supabase.from('services').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteService(id) {
  const { error } = await supabase.from('services').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

// ============================================
// BARBERS
// ============================================
async function getBarbers(activeOnly = true) {
  let q = supabase.from('barbers').select('*').order('sort_order');
  if (activeOnly) q = q.eq('is_active', true);
  const { data } = await q;
  return data || [];
}

async function getBarberById(id) {
  const { data } = await supabase.from('barbers').select('*').eq('id', id).single();
  return data;
}

async function createBarber(barber) {
  const { data, error } = await supabase.from('barbers').insert(barber).select().single();
  if (error) throw error;
  return data;
}

async function updateBarber(id, updates) {
  const { data, error } = await supabase.from('barbers').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ============================================
// BOOKINGS
// ============================================
async function createBooking(booking) {
  const { data, error } = await supabase.from('bookings').insert(booking).select('*, services(name, price), barbers(name)').single();
  if (error) throw error;
  return data;
}

async function getBookingById(id) {
  const { data } = await supabase.from('bookings').select('*, services(name, price, duration_minutes), barbers(name)').eq('id', id).single();
  return data;
}

async function updateBookingStatus(id, status) {
  const { data, error } = await supabase.from('bookings').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function getBookingsByDate(date) {
  const { data } = await supabase.from('bookings')
    .select('*, services(name, price, duration_minutes), barbers(name)')
    .eq('booking_date', date)
    .neq('status', 'cancelled')
    .order('booking_time');
  return data || [];
}

async function getBookingsByDateRange(startDate, endDate) {
  const { data } = await supabase.from('bookings')
    .select('*, services(name, price, duration_minutes), barbers(name)')
    .gte('booking_date', startDate)
    .lte('booking_date', endDate)
    .order('booking_date')
    .order('booking_time');
  return data || [];
}

async function getBookingsByBarberAndDate(barberId, date) {
  const { data } = await supabase.from('bookings')
    .select('*')
    .eq('barber_id', barberId)
    .eq('booking_date', date)
    .neq('status', 'cancelled')
    .order('booking_time');
  return data || [];
}

async function getBookingsCount(startDate, endDate) {
  const { count } = await supabase.from('bookings')
    .select('*', { count: 'exact', head: true })
    .gte('booking_date', startDate)
    .lte('booking_date', endDate)
    .neq('status', 'cancelled');
  return count || 0;
}

async function getRevenueByDateRange(startDate, endDate) {
  const { data } = await supabase.from('bookings')
    .select('total_price, booking_date, status')
    .gte('booking_date', startDate)
    .lte('booking_date', endDate)
    .eq('status', 'completed');
  return data || [];
}

async function getBookingsForAnalytics(startDate, endDate) {
  const { data } = await supabase.from('bookings')
    .select('*, services(name, category, price), barbers(name)')
    .gte('booking_date', startDate)
    .lte('booking_date', endDate)
    .neq('status', 'cancelled')
    .order('booking_date')
    .order('booking_time');
  return data || [];
}

async function getAllBookings({ page = 1, limit = 50, status, date } = {}) {
  const from = (page - 1) * limit;
  let q = supabase.from('bookings')
    .select('*, services(name, price), barbers(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);
  if (status) q = q.eq('status', status);
  if (date) q = q.eq('booking_date', date);
  const { data, count } = await q;
  return { data: data || [], total: count || 0 };
}

// ============================================
// OPERATING HOURS
// ============================================
async function getOperatingHours() {
  const { data } = await supabase.from('operating_hours').select('*').order('day_of_week');
  return data || [];
}

async function updateOperatingHours(dayOfWeek, updates) {
  const { data, error } = await supabase.from('operating_hours').update(updates).eq('day_of_week', dayOfWeek).select().single();
  if (error) throw error;
  return data;
}

// ============================================
// BARBER SCHEDULES
// ============================================
async function getBarberSchedule(barberId, dayOfWeek) {
  const { data } = await supabase.from('barber_schedules')
    .select('*')
    .eq('barber_id', barberId)
    .eq('day_of_week', dayOfWeek)
    .single();
  return data;
}

async function getBarberSchedules(barberId) {
  const { data } = await supabase.from('barber_schedules')
    .select('*')
    .eq('barber_id', barberId)
    .order('day_of_week');
  return data || [];
}

async function getAvailableBarbersForDay(dayOfWeek) {
  const { data } = await supabase.from('barber_schedules')
    .select('*, barbers(id, name, speciality, is_active)')
    .eq('day_of_week', dayOfWeek)
    .eq('is_off', false);
  return (data || []).filter(s => s.barbers?.is_active);
}

async function getAllBarberSchedules() {
  const { data } = await supabase.from('barber_schedules')
    .select('*')
    .order('barber_id')
    .order('day_of_week');
  return data || [];
}

async function upsertBarberSchedule(barberId, dayOfWeek, updates) {
  const { data, error } = await supabase.from('barber_schedules')
    .upsert({ barber_id: barberId, day_of_week: dayOfWeek, ...updates }, { onConflict: 'barber_id,day_of_week' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================
// ANALYTICS HELPERS
// ============================================
async function getPopularServices(startDate, endDate) {
  const { data } = await supabase.from('bookings')
    .select('service_id, services(name, price)')
    .gte('booking_date', startDate)
    .lte('booking_date', endDate)
    .neq('status', 'cancelled');

  const counts = {};
  (data || []).forEach(b => {
    const name = b.services?.name || 'Unknown';
    counts[name] = (counts[name] || 0) + 1;
  });
  return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

async function getBarberPerformance(startDate, endDate) {
  const { data } = await supabase.from('bookings')
    .select('barber_id, total_price, status, barbers(name)')
    .gte('booking_date', startDate)
    .lte('booking_date', endDate)
    .neq('status', 'cancelled');

  const stats = {};
  (data || []).forEach(b => {
    const name = b.barbers?.name || 'Unknown';
    if (!stats[name]) stats[name] = { name, bookings: 0, revenue: 0, completed: 0 };
    stats[name].bookings++;
    if (b.status === 'completed') {
      stats[name].completed++;
      stats[name].revenue += b.total_price || 0;
    }
  });
  return Object.values(stats).sort((a, b) => b.revenue - a.revenue);
}

async function resetAllBookings() {
  const { error } = await supabase.from('bookings').delete().gte('created_at', '2000-01-01');
  if (error) throw error;
}

module.exports = {
  supabase,
  getUserByUsername, createUser, updateUserPassword, getNonAdminUsers,
  getServices, getServiceById, createService, updateService, deleteService,
  getBarbers, getBarberById, createBarber, updateBarber,
  createBooking, getBookingById, updateBookingStatus,
  getBookingsByDate, getBookingsByDateRange, getBookingsByBarberAndDate,
  getBookingsCount, getRevenueByDateRange, getBookingsForAnalytics, getAllBookings,
  getOperatingHours, updateOperatingHours,
  getBarberSchedule, getBarberSchedules, getAvailableBarbersForDay, getAllBarberSchedules, upsertBarberSchedule,
  getPopularServices, getBarberPerformance,
  resetAllBookings
};

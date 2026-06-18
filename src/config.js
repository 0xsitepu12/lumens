const STORE_NAME = 'LUMENS HAIR STUDIO';

const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
};

const ROLES = {
  ADMIN: 'admin',
  BARBER: 'barber'
};

const SLOT_INTERVAL_MINUTES = 60;

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

module.exports = { STORE_NAME, BOOKING_STATUS, ROLES, SLOT_INTERVAL_MINUTES, DAYS_ID, COOKIE_OPTIONS };

let currentDate = new Date().toISOString().split('T')[0];
let bookings = [];
let refreshTimer = null;
let lastBookingCount = -1;
function playNotifSound() {
  var ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();

  function beep(freq, start, dur) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.value = 1;
    o.connect(g);
    g.connect(ctx.destination);
    o.start(ctx.currentTime + start);
    o.stop(ctx.currentTime + start + dur);
  }

  beep(800, 0, 0.15);
  beep(1000, 0.2, 0.15);
  beep(1200, 0.4, 0.2);
}

const STATUS_MAP = {
  pending: { label: 'Pending', cls: 'pending' },
  confirmed: { label: 'Confirmed', cls: 'confirmed' },
  completed: { label: 'Selesai', cls: 'completed' },
  cancelled: { label: 'Batal', cls: 'cancelled' },
  no_show: { label: 'No Show', cls: 'cancelled' }
};

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) throw new Error();
  } catch {
    window.location.href = '/login';
  }
}

async function loadBookings() {
  try {
    const res = await fetch(`/api/booking/kasir/today?date=${currentDate}`, { credentials: 'include' });
    const data = await res.json();
    if (!data.success) { if (res.status === 401) window.location.href = '/login'; return; }
    const newBookings = data.data || [];
    if (lastBookingCount >= 0 && newBookings.length > lastBookingCount) {
      playNotifSound();
    }
    lastBookingCount = newBookings.length;
    bookings = newBookings;
    render();
  } catch {}
}

function render() {
  renderSummary();
  renderList();
}

function renderSummary() {
  const total = bookings.length;
  const pending = bookings.filter(b => b.status === 'pending').length;
  const confirmed = bookings.filter(b => b.status === 'confirmed').length;
  const completed = bookings.filter(b => b.status === 'completed').length;

  document.getElementById('sum-total').textContent = total;
  document.getElementById('sum-pending').textContent = pending;
  document.getElementById('sum-confirmed').textContent = confirmed;
  document.getElementById('sum-completed').textContent = completed;
}

function renderList() {
  const container = document.getElementById('booking-list');

  const active = bookings.filter(b => b.status !== 'cancelled');
  if (active.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-regular fa-calendar-check"></i><p>Tidak ada booking</p></div>';
    return;
  }

  container.innerHTML = active.map(b => {
    const s = STATUS_MAP[b.status] || STATUS_MAP.pending;
    const time = b.booking_time?.slice(0, 5) || '';
    const name = esc(b.customer_name);
    const service = esc(b.services?.name || '-');
    const stylist = esc(b.barbers?.name || '-');
    const phone = esc(b.customer_phone || '');

    return `
      <div class="booking-card" data-booking-id="${b.id}">
        <div class="booking-info">
          <span class="booking-time-badge">${time}</span>
          <div class="booking-name">${name}</div>
          <div class="booking-detail">${service} &middot; ${stylist}</div>
          <div class="booking-phone">${phone}</div>
        </div>
        <button class="status-btn ${s.cls}" data-open-sheet="${b.id}">${s.label}</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-open-sheet]').forEach(btn => {
    btn.addEventListener('click', () => openStatusSheet(btn.dataset.openSheet));
  });
}

let activeBookingId = null;

function openStatusSheet(id) {
  activeBookingId = id;
  const overlay = document.getElementById('status-overlay');
  const sheet = document.getElementById('status-sheet');
  const actions = document.getElementById('status-actions');

  actions.innerHTML = `
    <button class="status-menu-item confirm" data-action="confirmed"><i class="fa-solid fa-check"></i> Konfirmasi</button>
    <button class="status-menu-item complete" data-action="completed"><i class="fa-solid fa-check-double"></i> Selesai</button>
    <button class="status-menu-item noshow" data-action="no_show"><i class="fa-solid fa-user-slash"></i> Tidak Hadir</button>
    <button class="status-menu-item cancel" data-action="cancelled"><i class="fa-solid fa-times"></i> Batalkan</button>
  `;

  actions.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      updateStatus(activeBookingId, btn.dataset.action);
      closeStatusSheet();
    });
  });

  overlay.classList.add('show');
  sheet.classList.add('show');
}

function closeStatusSheet() {
  document.getElementById('status-overlay').classList.remove('show');
  document.getElementById('status-sheet').classList.remove('show');
  activeBookingId = null;
}

async function updateStatus(id, status) {
  try {
    const res = await fetch(`/api/booking/kasir/status/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.success) loadBookings();
  } catch {}
}

function switchDate(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  currentDate = d.toISOString().split('T')[0];

  document.querySelectorAll('.kasir-tab').forEach((t, i) => {
    t.classList.toggle('active', i === offset);
  });

  updateDateDisplay();
  loadBookings();
}

function updateDateDisplay() {
  const d = new Date(currentDate + 'T00:00:00');
  const formatted = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('kasir-date').textContent = formatted;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(loadBookings, 30000);
}

// ============================================
// WALK-IN BOOKING
// ============================================
function nowRoundedUp() {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d.toTimeString().slice(0, 5);
}

async function loadWalkInSlots() {
  const serviceEl = document.getElementById('wi-service');
  const barberEl  = document.getElementById('wi-barber');
  const dateEl    = document.getElementById('wi-date');
  const timeSel   = document.getElementById('wi-time');
  const msgEl     = document.getElementById('wi-slots-msg');

  const serviceOpt = serviceEl.options[serviceEl.selectedIndex];
  const duration   = serviceOpt ? serviceOpt.dataset.duration : null;
  const barberId   = barberEl.value;
  const date       = dateEl.value;

  if (!duration || !barberId || !date) {
    timeSel.innerHTML = '<option value="">— Pilih layanan &amp; stylist dulu —</option>';
    msgEl.style.display = 'none';
    return;
  }

  timeSel.innerHTML = '<option value="">— Memuat slot... —</option>';
  msgEl.style.display = 'none';

  try {
    const res = await fetch(`/api/booking/slots?date=${date}&barber_id=${barberId}&duration=${duration}`, { credentials: 'include' });
    const data = await res.json();
    const slots = (data.data || []).filter(s => s.available);

    if (slots.length === 0) {
      timeSel.innerHTML = '<option value="">— Tidak ada slot tersedia —</option>';
      msgEl.textContent = 'Semua jam sudah penuh atau stylist libur di hari ini.';
      msgEl.style.display = '';
    } else {
      timeSel.innerHTML = '<option value="">— Pilih Jam —</option>' +
        slots.map(s => `<option value="${s.time}">${s.time}</option>`).join('');
    }
  } catch {
    timeSel.innerHTML = '<option value="">— Gagal memuat slot —</option>';
  }
}

async function openWalkInModal() {
  const overlay = document.getElementById('walkin-overlay');
  const errEl  = document.getElementById('wi-error');
  errEl.style.display = 'none';

  // Reset fields
  document.getElementById('wi-date').value = currentDate;
  document.getElementById('wi-name').value = '';
  document.getElementById('wi-phone').value = '';
  document.getElementById('wi-time').innerHTML = '<option value="">— Pilih layanan &amp; stylist dulu —</option>';
  document.getElementById('wi-slots-msg').style.display = 'none';

  // Load layanan
  const svcSel = document.getElementById('wi-service');
  svcSel.innerHTML = '<option value="">— Memuat... —</option>';
  try {
    const res = await fetch('/api/booking/services', { credentials: 'include' });
    const data = await res.json();
    const services = data.data || [];
    svcSel.innerHTML = '<option value="">— Pilih Layanan —</option>' +
      services.map(s => `<option value="${s.id}" data-price="${s.price}" data-duration="${s.duration_minutes}">${s.name} — Rp ${s.price.toLocaleString('id-ID')}</option>`).join('');
  } catch {
    svcSel.innerHTML = '<option value="">— Gagal memuat —</option>';
  }

  // Load barbers
  const barberSel = document.getElementById('wi-barber');
  barberSel.innerHTML = '<option value="">— Memuat... —</option>';
  try {
    const res = await fetch(`/api/booking/barbers?date=${currentDate}`, { credentials: 'include' });
    const data = await res.json();
    const barbers = data.data || [];
    barberSel.innerHTML = '<option value="">— Pilih Stylist —</option>' +
      barbers.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  } catch {
    barberSel.innerHTML = '<option value="">— Gagal memuat —</option>';
  }

  overlay.classList.add('show');
}

function closeWalkInModal() {
  document.getElementById('walkin-overlay').classList.remove('show');
}

async function submitWalkIn() {
  const name    = document.getElementById('wi-name').value.trim() || 'Tamu Umum';
  const phone   = document.getElementById('wi-phone').value.trim() || '-';
  const service = document.getElementById('wi-service').value;
  const barber  = document.getElementById('wi-barber').value;
  const date    = document.getElementById('wi-date').value;
  const time    = document.getElementById('wi-time').value;
  const errEl   = document.getElementById('wi-error');
  const btn     = document.getElementById('wi-submit');

  errEl.style.display = 'none';
  if (!service || !barber || !date || !time) {
    errEl.textContent = 'Layanan, stylist, tanggal, dan jam wajib diisi.';
    errEl.style.display = '';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Menyimpan...';
  try {
    const res = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        customer_name: name,
        customer_phone: phone,
        service_id: service,
        barber_id: barber,
        booking_date: date,
        booking_time: time.length === 5 ? time + ':00' : time,
        notes: 'Walk-in'
      })
    });
    const data = await res.json();
    if (data.success) {
      closeWalkInModal();
      await loadBookings();
    } else {
      errEl.textContent = data.message || 'Gagal membuat booking.';
      errEl.style.display = '';
    }
  } catch {
    errEl.textContent = 'Terjadi kesalahan. Coba lagi.';
    errEl.style.display = '';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Buat Booking';
  }
}

document.getElementById('status-overlay')?.addEventListener('click', closeStatusSheet);

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  updateDateDisplay();

  document.querySelectorAll('.kasir-tab').forEach((tab, i) => {
    tab.addEventListener('click', () => switchDate(i));
  });

  document.getElementById('btn-refresh')?.addEventListener('click', loadBookings);
  document.getElementById('btn-walkin')?.addEventListener('click', openWalkInModal);
  document.getElementById('wi-submit')?.addEventListener('click', submitWalkIn);
  document.getElementById('walkin-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('walkin-overlay')) closeWalkInModal();
  });
  ['wi-service', 'wi-barber', 'wi-date'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', loadWalkInSlots);
  });
  document.getElementById('btn-test-sound')?.addEventListener('click', playNotifSound);
  document.getElementById('btn-logout-kasir')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  });

  await loadBookings();
  startAutoRefresh();
});

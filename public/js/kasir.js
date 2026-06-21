let currentDate = new Date().getFullYear() + '-' + String(new Date().getMonth()+1).padStart(2,'0') + '-' + String(new Date().getDate()).padStart(2,'0');
let bookings = [];
let refreshTimer = null;
let lastBookingCount = -1;
let kcalWeekStart = null;

const KDAYS = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const KMONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function fmtDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function getKWeekStart(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function renderKCalendar() {
  const grid = document.getElementById('kcal-grid');
  const title = document.getElementById('kcal-title');
  if (!grid) return;

  const today = fmtDateStr(new Date());
  const weekEnd = new Date(kcalWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const sm = KMONTHS[kcalWeekStart.getMonth()];
  const em = KMONTHS[weekEnd.getMonth()];
  title.textContent = sm === em
    ? kcalWeekStart.getDate() + ' - ' + weekEnd.getDate() + ' ' + em + ' ' + weekEnd.getFullYear()
    : kcalWeekStart.getDate() + ' ' + sm + ' - ' + weekEnd.getDate() + ' ' + em;

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(kcalWeekStart);
    d.setDate(d.getDate() + i);
    const ds = fmtDateStr(d);
    const isToday = ds === today ? ' today' : '';
    const isSel = ds === currentDate ? ' selected' : '';
    html += '<button class="kasir-cal-cell' + isToday + isSel + '" data-date="' + ds + '">'
      + '<span class="kasir-cal-day">' + KDAYS[d.getDay()] + '</span>'
      + '<span class="kasir-cal-num">' + d.getDate() + '</span>'
      + '</button>';
  }
  grid.innerHTML = html;

  grid.querySelectorAll('[data-date]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      currentDate = btn.dataset.date;
      updateDateDisplay();
      renderKCalendar();
      loadBookings();
    });
  });
}
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
  const completed = bookings.filter(b => b.status === 'completed').length;
  const omset = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.total_price || 0), 0);

  document.getElementById('sum-total').textContent = total;
  document.getElementById('sum-pending').textContent = pending;
  document.getElementById('sum-completed').textContent = completed;
  document.getElementById('sum-omset').textContent = 'Rp ' + omset.toLocaleString('id-ID');
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
        <span class="booking-time-badge">${time}</span>
        <div class="booking-info">
          <div class="booking-name">${name}</div>
          <div class="booking-detail">${service} &middot; ${stylist}</div>
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

function kcalPrev() {
  kcalWeekStart.setDate(kcalWeekStart.getDate() - 7);
  renderKCalendar();
}

function kcalNext() {
  kcalWeekStart.setDate(kcalWeekStart.getDate() + 7);
  renderKCalendar();
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
  refreshTimer = setInterval(loadBookings, 60000);
}

async function startRealtime() {
  try {
    const configRes = await fetch('/api/config');
    const config = await configRes.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey) return;

    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

    supabase.channel('kasir-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadBookings();
      })
      .subscribe();

    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  } catch {
    startAutoRefresh();
  }
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
      services.map(s => `<option value="${s.id}" data-price="${s.price}" data-duration="${s.duration_minutes}">${esc(s.name)} — Rp ${s.price.toLocaleString('id-ID')}</option>`).join('');
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
      barbers.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
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
    const res = await fetch('/api/booking/create', {
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

  kcalWeekStart = getKWeekStart(currentDate);
  renderKCalendar();
  document.getElementById('kcal-prev')?.addEventListener('click', kcalPrev);
  document.getElementById('kcal-next')?.addEventListener('click', kcalNext);

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
  startRealtime();
});

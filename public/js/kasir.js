let currentDate = new Date().getFullYear() + '-' + String(new Date().getMonth()+1).padStart(2,'0') + '-' + String(new Date().getDate()).padStart(2,'0');
let bookings = [];
let refreshTimer = null;
let lastBookingCount = -1;
let kcalWeekStart = null;
let weekBookingCounts = {};
let activeBarberFilter = null;
let searchQuery = '';

const KDAYS = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const KMONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// ============================================
// TAB SWITCHING (Booking | POS | Riwayat)
// ============================================
let posInitialized = false;

function switchKTab(tab) {
  document.querySelectorAll('.k-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.querySelectorAll('.k-content').forEach(c => c.classList.remove('active'));
  const content = document.getElementById('tab-' + tab);
  if (content) content.classList.add('active');

  // FABs (walk-in + refresh) only on booking tab
  const onBooking = tab === 'booking';
  const walkin = document.getElementById('btn-walkin');
  const refresh = document.getElementById('btn-refresh');
  if (walkin) walkin.style.display = onBooking ? '' : 'none';
  if (refresh) refresh.style.display = onBooking ? '' : 'none';

  if (tab === 'pos') {
    if (!posInitialized && typeof initPOS === 'function') {
      posInitialized = true;
      initPOS();
    }
  } else if (tab === 'riwayat') {
    if (!posInitialized && typeof initPOS === 'function') {
      posInitialized = true;
      initPOS();
    }
    if (typeof loadRiwayat === 'function') loadRiwayat();
  }
}

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
  if (!grid) return;

  const today = fmtDateStr(new Date());

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(kcalWeekStart);
    d.setDate(d.getDate() + i);
    const ds = fmtDateStr(d);
    const isToday = ds === today ? ' today' : '';
    const isSel = ds === currentDate ? ' selected' : '';
    const hasDot = weekBookingCounts[ds] ? '<span class="kasir-cal-dot"></span>' : '';
    html += '<button class="kasir-cal-cell' + isToday + isSel + '" data-date="' + ds + '">'
      + '<span class="kasir-cal-day">' + KDAYS[d.getDay()] + '</span>'
      + '<span class="kasir-cal-num">' + d.getDate() + '</span>'
      + hasDot
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
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.6, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(ctx.currentTime + start);
    o.stop(ctx.currentTime + start + dur);
  }

  beep(880, 0, 0.18);
  beep(1320, 0.2, 0.45);
}

const STATUS_MAP = {
  pending: { label: 'Menunggu', cls: 'pending' },
  confirmed: { label: 'Dikonfirmasi', cls: 'confirmed' },
  completed: { label: 'Selesai', cls: 'completed' },
  cancelled: { label: 'Batal', cls: 'cancelled' },
  no_show: { label: 'Tidak Hadir', cls: 'cancelled' }
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
  renderBarberChips();
  renderList();
}

function renderSummary() {
  const active = bookings.filter(b => b.status !== 'cancelled');
  const total = active.length;
  const pending = active.filter(b => b.status === 'pending').length;
  const confirmed = active.filter(b => b.status === 'confirmed').length;
  const completed = active.filter(b => b.status === 'completed').length;

  document.getElementById('sum-total').textContent = total;
  document.getElementById('sum-pending').textContent = pending;
  var confEl = document.getElementById('sum-confirmed');
  if (confEl) confEl.textContent = confirmed;
  document.getElementById('sum-completed').textContent = completed;
}

function getAvatarColor(name) {
  var colors = [
    { bg: '#dbeafe', fg: '#1e40af' },
    { bg: '#fef3c7', fg: '#92400e' },
    { bg: '#dcfce7', fg: '#166534' },
    { bg: '#f3e8ff', fg: '#6b21a8' },
    { bg: '#fce7f3', fg: '#9d174d' },
    { bg: '#e0e7ff', fg: '#3730a3' }
  ];
  var hash = 0;
  for (var i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
  return (name || '?').split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
}

function renderBarberChips() {
  var container = document.getElementById('barber-chips');
  if (!container) return;
  var barberNames = [];
  bookings.forEach(function(b) {
    var n = b.barbers?.name;
    if (n && barberNames.indexOf(n) === -1) barberNames.push(n);
  });

  var html = '<button class="b-chip' + (activeBarberFilter === null ? ' active' : '') + '" data-barber="">Semua</button>';
  barberNames.forEach(function(n) {
    html += '<button class="b-chip' + (activeBarberFilter === n ? ' active' : '') + '" data-barber="' + esc(n) + '">' + esc(n) + '</button>';
  });
  container.innerHTML = html;

  container.querySelectorAll('.b-chip').forEach(function(btn) {
    btn.addEventListener('click', function() {
      activeBarberFilter = btn.dataset.barber || null;
      renderBarberChips();
      renderList();
    });
  });
}

function renderList() {
  var container = document.getElementById('booking-list');
  var active = bookings.filter(function(b) { return b.status !== 'cancelled'; });

  if (activeBarberFilter) {
    active = active.filter(function(b) { return b.barbers?.name === activeBarberFilter; });
  }
  if (searchQuery) {
    var q = searchQuery.toLowerCase();
    active = active.filter(function(b) { return (b.customer_name || '').toLowerCase().indexOf(q) !== -1; });
  }

  if (active.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-regular fa-calendar-check"></i><p>Tidak ada booking</p></div>';
    return;
  }

  var groups = {};
  active.forEach(function(b) {
    var t = b.booking_time?.slice(0, 5) || '00:00';
    if (!groups[t]) groups[t] = [];
    groups[t].push(b);
  });

  var sortedTimes = Object.keys(groups).sort();

  var nowStr = '';
  var today = fmtDateStr(new Date());
  if (currentDate === today) {
    var now = new Date();
    nowStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  }

  var html = '';
  var nowInserted = false;

  sortedTimes.forEach(function(time) {
    if (nowStr && !nowInserted && time > nowStr) {
      html += '<div class="now-indicator"><span class="now-dot"></span><span class="now-line"></span><span class="now-text">Sekarang ' + nowStr + '</span></div>';
      nowInserted = true;
    }

    var items = groups[time];
    html += '<div class="time-group">';
    html += '<div class="time-header"><span class="time-line"></span><span class="time-label">' + time + '</span><span class="time-count">' + items.length + ' booking</span><span class="time-line"></span></div>';
    html += '<div class="time-cards">';

    items.forEach(function(b) {
      var s = STATUS_MAP[b.status] || STATUS_MAP.pending;
      var name = esc(b.customer_name);
      var service = esc(b.services?.name || '-');
      var stylist = esc(b.barbers?.name || '-');
      var avatar = getAvatarColor(stylist);
      var initials = getInitials(stylist);

      var orderedAt = '';
      if (b.created_at) {
        var ca = new Date(b.created_at);
        orderedAt = 'Dipesan ' + String(ca.getDate()).padStart(2,'0') + '/' + String(ca.getMonth()+1).padStart(2,'0') + '/' + String(ca.getFullYear()).slice(-2) + ' ' + ca.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
      }

      html += '<div class="booking-card status-' + b.status + '">';
      html += '<div class="bk-avatar" style="background:' + avatar.bg + ';color:' + avatar.fg + '">' + initials + '</div>';
      html += '<div class="booking-info">';
      html += '<div class="booking-name">' + name + '</div>';
      html += '<div class="booking-detail">' + service + ' &middot; ' + stylist + '</div>';
      if (orderedAt) html += '<div class="booking-phone">' + orderedAt + '</div>';
      html += '</div>';
      html += '<button class="status-btn ' + s.cls + '" data-open-sheet="' + b.id + '">' + s.label + '</button>';
      html += '</div>';
    });

    html += '</div></div>';
  });

  if (nowStr && !nowInserted) {
    html += '<div class="now-indicator"><span class="now-dot"></span><span class="now-line"></span><span class="now-text">Sekarang ' + nowStr + '</span></div>';
  }

  container.innerHTML = html;

  container.querySelectorAll('[data-open-sheet]').forEach(function(btn) {
    btn.addEventListener('click', function() { openStatusSheet(btn.dataset.openSheet); });
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

async function loadWeekCounts() {
  try {
    const start = fmtDateStr(kcalWeekStart);
    const end = new Date(kcalWeekStart);
    end.setDate(end.getDate() + 6);
    const endStr = fmtDateStr(end);
    const res = await fetch(`/api/booking/kasir/week-counts?start=${start}&end=${endStr}`, { credentials: 'include' });
    const data = await res.json();
    if (data.success) {
      weekBookingCounts = data.data;
      renderKCalendar();
    }
  } catch {}
}

function kcalPrev() {
  kcalWeekStart.setDate(kcalWeekStart.getDate() - 7);
  renderKCalendar();
  loadWeekCounts();
}

function kcalNext() {
  kcalWeekStart.setDate(kcalWeekStart.getDate() + 7);
  renderKCalendar();
  loadWeekCounts();
}

function updateDateDisplay() {
  const d = new Date(currentDate + 'T00:00:00');
  const formatted = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('kasir-date').textContent = formatted;
}

function startClock() {
  var el = document.getElementById('kasir-clock');
  if (!el) return;
  function tick() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2, '0');
    var m = String(now.getMinutes()).padStart(2, '0');
    var s = String(now.getSeconds()).padStart(2, '0');
    el.textContent = h + ':' + m + ':' + s;
  }
  tick();
  setInterval(tick, 1000);
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
let wiSelectedServices = [];
let wiAllServices = [];

function setDefaultWalkInTime() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('wi-time').value = h + ':' + m;
}

function formatRupiahShort(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function toggleWiService(id) {
  const idx = wiSelectedServices.indexOf(id);
  if (idx === -1) wiSelectedServices.push(id);
  else wiSelectedServices.splice(idx, 1);
  renderWiServiceChips();
  updateWiSummary();
}

const WI_CAT_ORDER = ['potong', 'perawatan', 'warna', 'lainnya'];
const WI_CAT_LABELS = {
  potong:    'Haircut',
  perawatan: 'Texturing & Conditioning',
  warna:     'Colouring',
  lainnya:   'Other Service'
};

function renderWiServiceChips() {
  const container = document.getElementById('wi-svc-list');
  if (!wiAllServices.length) {
    container.innerHTML = '<div class="wi-svc-empty"><i class="fa-solid fa-scissors" style="margin-right:4px"></i> Tidak ada layanan</div>';
    return;
  }

  var groups = {};
  wiAllServices.forEach(function(s) {
    var cat = (s.category || 'lainnya').toLowerCase();
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(s);
  });

  var html = '';
  WI_CAT_ORDER.forEach(function(cat) {
    if (!groups[cat] || !groups[cat].length) return;
    html += '<div class="wi-svc-cat">' + esc(WI_CAT_LABELS[cat] || cat) + '</div>';
    groups[cat].forEach(function(s) {
      var sel = wiSelectedServices.includes(s.id) ? ' selected' : '';
      html += '<div class="wi-svc-chip' + sel + '" data-id="' + s.id + '">' +
        '<span class="wi-svc-check"><i class="fa-solid fa-check"></i></span>' +
        '<div class="wi-svc-info"><div class="wi-svc-name">' + esc(s.name) + '</div>' +
        '<div class="wi-svc-meta">' + s.duration_minutes + ' menit</div></div>' +
        '<span class="wi-svc-price">' + formatRupiahShort(s.price) + '</span></div>';
    });
    delete groups[cat];
  });

  Object.keys(groups).forEach(function(cat) {
    if (!groups[cat].length) return;
    html += '<div class="wi-svc-cat">' + esc(cat.charAt(0).toUpperCase() + cat.slice(1)) + '</div>';
    groups[cat].forEach(function(s) {
      var sel = wiSelectedServices.includes(s.id) ? ' selected' : '';
      html += '<div class="wi-svc-chip' + sel + '" data-id="' + s.id + '">' +
        '<span class="wi-svc-check"><i class="fa-solid fa-check"></i></span>' +
        '<div class="wi-svc-info"><div class="wi-svc-name">' + esc(s.name) + '</div>' +
        '<div class="wi-svc-meta">' + s.duration_minutes + ' menit</div></div>' +
        '<span class="wi-svc-price">' + formatRupiahShort(s.price) + '</span></div>';
    });
  });

  container.innerHTML = html;
}

function updateWiSummary() {
  const summaryEl = document.getElementById('wi-summary');
  const selected = wiAllServices.filter(s => wiSelectedServices.includes(s.id));
  if (!selected.length) {
    summaryEl.classList.remove('show');
    return;
  }
  const totalPrice = selected.reduce((sum, s) => sum + s.price, 0);
  const totalDur = selected.reduce((sum, s) => sum + s.duration_minutes, 0);
  document.getElementById('wi-summary-count').textContent = selected.length + ' layanan';
  document.getElementById('wi-summary-dur').textContent = totalDur + ' menit total';
  document.getElementById('wi-summary-total').textContent = formatRupiahShort(totalPrice);
  summaryEl.classList.add('show');
}

async function openWalkInModal() {
  const overlay = document.getElementById('walkin-overlay');
  const errEl  = document.getElementById('wi-error');
  errEl.style.display = 'none';
  wiSelectedServices = [];

  document.getElementById('wi-date').value = currentDate;
  document.getElementById('wi-name').value = '';
  document.getElementById('wi-phone').value = '';
  setDefaultWalkInTime();

  // Load layanan
  const svcList = document.getElementById('wi-svc-list');
  svcList.innerHTML = '<div class="wi-svc-empty">Memuat layanan...</div>';
  try {
    const res = await fetch('/api/booking/services', { credentials: 'include' });
    const data = await res.json();
    wiAllServices = (data.data || []).map(s => ({
      id: s.id, name: s.name, price: s.price, duration_minutes: s.duration_minutes, category: s.category || 'lainnya'
    }));
    renderWiServiceChips();
  } catch {
    svcList.innerHTML = '<div class="wi-svc-empty">Gagal memuat layanan</div>';
  }
  updateWiSummary();

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

function addMinutesToTime(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

async function submitWalkIn() {
  const name    = document.getElementById('wi-name').value.trim() || 'Tamu Umum';
  const phone   = document.getElementById('wi-phone').value.trim();
  const barber  = document.getElementById('wi-barber').value;
  const date    = document.getElementById('wi-date').value;
  const time    = document.getElementById('wi-time').value;
  const errEl   = document.getElementById('wi-error');
  const btn     = document.getElementById('wi-submit');

  errEl.style.display = 'none';

  if (!phone) {
    errEl.textContent = 'Nomor HP wajib diisi.';
    errEl.style.display = '';
    return;
  }

  const selected = wiAllServices.filter(s => wiSelectedServices.includes(s.id));
  if (!selected.length || !barber || !date || !time) {
    errEl.textContent = 'Pilih minimal 1 layanan, stylist, dan jam.';
    errEl.style.display = '';
    return;
  }

  const [th, tm] = time.split(':').map(Number);
  const timeMin = th * 60 + tm;
  if (timeMin < 540) {
    errEl.textContent = 'Jam walk-in minimal 09:00. Toko buka jam 9 pagi.';
    errEl.style.display = '';
    return;
  }

  btn.disabled = true;
  const totalCount = selected.length;
  let currentTime = time;
  let successCount = 0;

  try {
    for (let i = 0; i < selected.length; i++) {
      const svc = selected[i];
      btn.textContent = totalCount > 1
        ? 'Menyimpan ' + (i + 1) + '/' + totalCount + '...'
        : 'Menyimpan...';

      const bookingTime = currentTime.length === 5 ? currentTime + ':00' : currentTime;
      const res = await fetch('/api/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customer_name: name,
          customer_phone: phone,
          service_id: svc.id,
          barber_id: barber,
          booking_date: date,
          booking_time: bookingTime,
          notes: 'Walk-in'
        })
      });
      const data = await res.json();
      if (data.success) {
        successCount++;
        currentTime = addMinutesToTime(currentTime, svc.duration_minutes);
      } else {
        errEl.textContent = (successCount > 0
          ? successCount + ' booking berhasil, tapi gagal di "' + svc.name + '": '
          : '') + (data.message || 'Gagal membuat booking.');
        errEl.style.display = '';
        break;
      }
    }

    if (successCount === totalCount) {
      closeWalkInModal();
      await loadBookings();
      loadWeekCounts();
    }
  } catch {
    errEl.textContent = 'Terjadi kesalahan. ' + (successCount > 0 ? successCount + ' booking sudah tersimpan.' : 'Coba lagi.');
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
  startClock();

  // Check POS enabled
  try {
    var posConf = await fetch('/api/app-config').then(r => r.json());
    if (!posConf.posEnabled) {
      document.querySelectorAll('.k-tab[data-tab="pos"], .k-tab[data-tab="riwayat"]').forEach(t => t.style.display = 'none');
    }
  } catch {}

  document.querySelectorAll('.k-tab').forEach(btn => {
    btn.addEventListener('click', () => switchKTab(btn.dataset.tab));
  });

  kcalWeekStart = getKWeekStart(currentDate);
  renderKCalendar();
  loadWeekCounts();
  document.getElementById('kcal-prev')?.addEventListener('click', kcalPrev);
  document.getElementById('kcal-next')?.addEventListener('click', kcalNext);

  var searchInput = document.getElementById('kasir-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      searchQuery = this.value.trim();
      renderList();
    });
  }

  document.getElementById('btn-refresh')?.addEventListener('click', () => { loadBookings(); loadWeekCounts(); });
  document.getElementById('btn-walkin')?.addEventListener('click', openWalkInModal);
  document.getElementById('wi-submit')?.addEventListener('click', submitWalkIn);
  document.getElementById('walkin-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('walkin-overlay')) closeWalkInModal();
  });
  document.getElementById('wi-svc-list')?.addEventListener('click', e => {
    const chip = e.target.closest('.wi-svc-chip');
    if (chip) toggleWiService(chip.dataset.id);
  });
  document.getElementById('btn-test-sound')?.addEventListener('click', playNotifSound);
  document.getElementById('btn-logout-kasir')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  });

  await loadBookings();
  startRealtime();
});

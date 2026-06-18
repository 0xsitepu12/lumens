let currentPeriod = 'today';

const STATUS_MAP = {
  pending:   { label: 'Pending',   cls: 'pending' },
  confirmed: { label: 'Confirmed', cls: 'confirmed' },
  completed: { label: 'Selesai',   cls: 'completed' },
  cancelled: { label: 'Batal',     cls: 'cancelled' },
  no_show:   { label: 'No Show',   cls: 'no_show' }
};

const PERIOD_LABEL = {
  today: 'Hari ini',
  week:  'Minggu ini',
  month: 'Bulan ini'
};

function fmt(n) {
  return 'Rp ' + (n || 0).toLocaleString('id-ID');
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) throw new Error();
  } catch {
    window.location.href = '/login';
  }
}

function showError(msg) {
  const el = document.getElementById('error-banner');
  el.textContent = msg;
  el.style.display = '';
}

function updateRateCircle(rate) {
  const circumference = 163.4;
  const offset = circumference - (rate / 100) * circumference;
  const arc = document.getElementById('rate-arc');
  if (arc) arc.style.strokeDashoffset = offset;
  const val = document.getElementById('stat-rate');
  if (val) val.textContent = rate + '%';
}

function renderStats(data) {
  document.getElementById('stat-revenue').textContent  = fmt(data.revenue);
  document.getElementById('stat-period-label').textContent = PERIOD_LABEL[currentPeriod];
  document.getElementById('stat-total').textContent     = data.total;
  document.getElementById('stat-completed').textContent = data.completed;
  document.getElementById('stat-confirmed').textContent = data.confirmed;
  document.getElementById('stat-pending').textContent   = data.pending;
  updateRateCircle(data.rate);
}

function renderList(bookings) {
  const container = document.getElementById('booking-list');
  const countEl   = document.getElementById('list-count');

  if (!bookings.length) {
    countEl.textContent = '';
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-calendar-check"></i>
        <p>Tidak ada booking di periode ini</p>
      </div>`;
    return;
  }

  countEl.textContent = bookings.length + ' booking';

  const showDate = currentPeriod !== 'today';

  container.innerHTML = bookings.map(b => {
    const s       = STATUS_MAP[b.status] || STATUS_MAP.pending;
    const time    = b.booking_time?.slice(0, 5) || '';
    const name    = esc(b.customer_name);
    const svc     = esc(b.services?.name || '-');
    const price   = b.total_price || b.services?.price || 0;
    const isDone  = b.status === 'completed';
    const isCancelled = ['cancelled', 'no_show'].includes(b.status);

    let dateStr = '';
    if (showDate) {
      const d = new Date(b.booking_date + 'T00:00:00');
      dateStr = `<div class="bk-date">${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</div>`;
    }

    return `
      <div class="bk-card">
        <div class="bk-time">${time}</div>
        <div class="bk-info">
          ${dateStr}
          <div class="bk-name">${name}</div>
          <div class="bk-svc">${svc}</div>
        </div>
        <div class="bk-right">
          <span class="bk-badge ${s.cls}">${s.label}</span>
          <div class="bk-price ${isCancelled ? 'muted' : ''}">${isDone || !isCancelled ? fmt(price) : '-'}</div>
        </div>
      </div>`;
  }).join('');
}

async function loadDashboard() {
  try {
    const res  = await fetch(`/api/barber/stats?period=${currentPeriod}`, { credentials: 'include' });
    const data = await res.json();

    if (!data.success) {
      showError(data.message || 'Gagal memuat data');
      return;
    }

    // Set name & avatar
    const barber = data.data.barber;
    const nameEl = document.getElementById('hdr-name');
    const avatarEl = document.getElementById('hdr-avatar');
    if (nameEl) nameEl.textContent = barber.name;
    if (avatarEl) avatarEl.textContent = barber.name.charAt(0).toUpperCase();

    renderStats(data.data);
    renderList(data.data.bookings);

  } catch {
    showError('Terjadi kesalahan. Coba refresh halaman.');
  }
}

function switchPeriod(period) {
  currentPeriod = period;
  document.querySelectorAll('.period-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.period === period);
  });
  document.getElementById('booking-list').innerHTML =
    '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Memuat...</p></div>';
  loadDashboard();
}

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();

  document.querySelectorAll('.period-tab').forEach(btn => {
    btn.addEventListener('click', () => switchPeriod(btn.dataset.period));
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  });

  await loadDashboard();
});

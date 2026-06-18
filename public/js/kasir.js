let currentDate = new Date().toISOString().split('T')[0];
let bookings = [];
let refreshTimer = null;

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
    bookings = data.data || [];
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
      <div class="booking-card">
        <div class="booking-info">
          <span class="booking-time-badge">${time}</span>
          <div class="booking-name">${name}</div>
          <div class="booking-detail">${service} &middot; ${stylist}</div>
          <div class="booking-phone">${phone}</div>
        </div>
        <div class="status-wrap">
          <button class="status-btn ${s.cls}" data-toggle-menu>${s.label}</button>
          <div class="status-menu">
            <button class="status-menu-item confirm" data-action="confirmed" data-id="${b.id}"><i class="fa-solid fa-check"></i> Konfirmasi</button>
            <button class="status-menu-item complete" data-action="completed" data-id="${b.id}"><i class="fa-solid fa-check-double"></i> Selesai</button>
            <button class="status-menu-item noshow" data-action="no_show" data-id="${b.id}"><i class="fa-solid fa-user-slash"></i> Tidak Hadir</button>
            <button class="status-menu-item cancel" data-action="cancelled" data-id="${b.id}"><i class="fa-solid fa-times"></i> Batalkan</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-toggle-menu]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.status-menu.show').forEach(m => m.classList.remove('show'));
      btn.nextElementSibling.classList.toggle('show');
    });
  });

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => updateStatus(btn.dataset.id, btn.dataset.action));
  });
}

async function updateStatus(id, status) {
  document.querySelectorAll('.status-menu.show').forEach(m => m.classList.remove('show'));
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

document.addEventListener('click', function(e) {
  if (!e.target.closest('.status-wrap')) {
    document.querySelectorAll('.status-menu.show').forEach(m => m.classList.remove('show'));
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  updateDateDisplay();

  document.querySelectorAll('.kasir-tab').forEach((tab, i) => {
    tab.addEventListener('click', () => switchDate(i));
  });

  document.getElementById('btn-refresh')?.addEventListener('click', loadBookings);

  await loadBookings();
  startAutoRefresh();
});

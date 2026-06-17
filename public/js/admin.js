let currentUser = null;
let charts = {};

async function checkAuth() {
  try {
    const res = await apiGet('/api/auth/me');
    if (!res.success) throw new Error();
    currentUser = res.user;
    const el = document.getElementById('admin-name');
    if (el) el.textContent = currentUser.fullName || currentUser.username;
  } catch {
    window.location.href = '/login';
  }
}

async function logout() {
  await apiPost('/api/auth/logout', {});
  window.location.href = '/login';
}

// ============================================
// TAB NAVIGATION
// ============================================
function switchTab(tabName) {
  document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-sidebar__item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.admin-tabs__item').forEach(b => b.classList.remove('active'));

  const tab = document.getElementById('tab-' + tabName);
  if (tab) tab.classList.add('active');

  document.querySelectorAll(`[data-tab="${tabName}"]`).forEach(b => b.classList.add('active'));

  if (tabName === 'dashboard') loadDashboard();
  if (tabName === 'bookings') loadBookings();
  if (tabName === 'services') loadAdminServices();
  if (tabName === 'barbers') loadAdminBarbers();
  if (tabName === 'settings') loadSettings();
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
  try {
    const res = await apiGet('/api/admin/dashboard');
    if (!res.success) return;
    const d = res.data;

    setText('stat-bookings', d.today.total);
    setText('stat-revenue', formatRupiah(d.today.revenue));
    setText('stat-pending', d.today.pending);
    setText('stat-completed', d.today.completed);

    loadCharts();
  } catch {
    showToast('Gagal memuat dashboard', 'error');
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function loadCharts() {
  const period = document.getElementById('filter-period')?.value || 'month';
  const { start, end } = getDateRange(period);

  try {
    const [peakHours, peakDays, revenue, services, barberPerf] = await Promise.all([
      apiGet(`/api/admin/analytics/peak-hours?start=${start}&end=${end}`),
      apiGet(`/api/admin/analytics/peak-days?start=${start}&end=${end}`),
      apiGet(`/api/admin/analytics/revenue?start=${start}&end=${end}`),
      apiGet(`/api/admin/analytics/services?start=${start}&end=${end}`),
      apiGet(`/api/admin/analytics/barbers?start=${start}&end=${end}`)
    ]);

    renderPeakHoursChart(peakHours.data || []);
    renderPeakDaysChart(peakDays.data || []);
    renderRevenueChart(revenue.data || []);
    renderServicesChart(services.data || []);
    renderBarberTable(barberPerf.data || []);
  } catch {
    showToast('Gagal memuat analytics', 'error');
  }
}

function getDateRange(period) {
  const today = new Date();
  const end = today.toISOString().split('T')[0];
  let start;

  if (period === 'today') {
    start = end;
  } else if (period === 'week') {
    const d = new Date(today); d.setDate(d.getDate() - 7);
    start = d.toISOString().split('T')[0];
  } else if (period === 'month') {
    start = end.slice(0, 7) + '-01';
  } else if (period === 'custom') {
    start = document.getElementById('filter-date-start')?.value || end.slice(0, 7) + '-01';
    const customEnd = document.getElementById('filter-date-end')?.value;
    return { start, end: customEnd || end };
  }
  return { start, end };
}

const chartColors = {
  gold: '#c0c0c0',
  blue: '#60a5fa',
  green: '#4ade80',
  red: '#f87171',
  purple: '#a78bfa',
  yellow: '#fbbf24',
  teal: '#34d399',
  pink: '#f472b6'
};

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#8a8a9a' }, grid: { color: '#1e1e28' } },
    y: { ticks: { color: '#8a8a9a', stepSize: 1 }, grid: { color: '#1e1e28' }, beginAtZero: true }
  }
};

function renderPeakHoursChart(data) {
  const ctx = document.getElementById('chart-peak-hours');
  if (!ctx) return;
  if (charts.peakHours) charts.peakHours.destroy();

  charts.peakHours = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => `${String(d.hour).padStart(2, '0')}:00`),
      datasets: [{ label: 'Booking', data: data.map(d => d.count), backgroundColor: chartColors.gold, borderRadius: 4 }]
    },
    options: { ...chartDefaults }
  });
}

function renderPeakDaysChart(data) {
  const ctx = document.getElementById('chart-peak-days');
  if (!ctx) return;
  if (charts.peakDays) charts.peakDays.destroy();

  charts.peakDays = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.day),
      datasets: [{ label: 'Booking', data: data.map(d => d.count), backgroundColor: chartColors.blue, borderRadius: 4 }]
    },
    options: { ...chartDefaults }
  });
}

function renderRevenueChart(data) {
  const ctx = document.getElementById('chart-revenue');
  if (!ctx) return;
  if (charts.revenue) charts.revenue.destroy();

  charts.revenue = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => formatDateShort(d.date)),
      datasets: [{
        label: 'Pendapatan', data: data.map(d => d.amount),
        borderColor: chartColors.green, backgroundColor: 'rgba(74,222,128,0.1)',
        fill: true, tension: 0.3, pointRadius: 3
      }]
    },
    options: {
      ...chartDefaults,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => formatRupiah(c.parsed.y) } } },
      scales: {
        x: { ticks: { color: '#8a8a9a' }, grid: { color: '#1e1e28' } },
        y: { ticks: { color: '#8a8a9a', callback: v => formatRupiah(v) }, grid: { color: '#1e1e28' }, beginAtZero: true }
      }
    }
  });
}

function renderServicesChart(data) {
  const ctx = document.getElementById('chart-services');
  if (!ctx) return;
  if (charts.services) charts.services.destroy();

  const colors = Object.values(chartColors);
  charts.services = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.name),
      datasets: [{ data: data.map(d => d.count), backgroundColor: colors.slice(0, data.length) }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#8a8a9a', padding: 12 } } }
    }
  });
}

function renderBarberTable(data) {
  const tbody = document.getElementById('barber-performance-body');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><i class="fa-solid fa-user-tie"></i><p>Belum ada data performa</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = data.map(b => `
    <tr>
      <td>${esc(b.name)}</td>
      <td>${b.bookings}</td>
      <td>${b.completed}</td>
      <td>${formatRupiah(b.revenue)}</td>
    </tr>
  `).join('');
}

// ============================================
// BOOKINGS MANAGEMENT
// ============================================
let bookingsPage = 1;

async function loadBookings() {
  const status = document.getElementById('booking-filter-status')?.value || '';
  const date = document.getElementById('booking-filter-date')?.value || '';

  try {
    const res = await apiGet(`/api/admin/bookings?page=${bookingsPage}&status=${status}&date=${date}`);
    if (!res.success) return;

    const tbody = document.getElementById('bookings-table-body');
    if (!tbody) return;

    if (res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-calendar-xmark"></i><p>Tidak ada booking</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(b => `
      <tr>
        <td>
          <div>${b.booking_time?.slice(0, 5)}</div>
          <small style="color: var(--text-muted)">${formatDateShort(b.booking_date)}</small>
        </td>
        <td>
          <div>${esc(b.customer_name)}</div>
          <small style="color: var(--text-muted)">${esc(b.customer_phone)}</small>
        </td>
        <td>${esc(b.services?.name || '-')}</td>
        <td>${esc(b.barbers?.name || '-')}</td>
        <td>${getStatusBadge(b.status)}</td>
        <td><div class="btn-group">${getBookingActions(b)}</div></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-status-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [id, status] = btn.dataset.statusAction.split(':');
        updateStatus(id, status);
      });
    });

    renderPagination(res.total);
  } catch {
    showToast('Gagal memuat booking', 'error');
  }
}

function getBookingActions(b) {
  const btns = [];
  if (b.status === 'pending') {
    btns.push(`<button class="btn btn--info btn--sm" data-status-action="${b.id}:confirmed" title="Konfirmasi"><i class="fa-solid fa-check"></i></button>`);
    btns.push(`<button class="btn btn--danger btn--sm" data-status-action="${b.id}:cancelled" title="Batalkan"><i class="fa-solid fa-times"></i></button>`);
  }
  if (b.status === 'confirmed') {
    btns.push(`<button class="btn btn--success btn--sm" data-status-action="${b.id}:completed" title="Selesai"><i class="fa-solid fa-check-double"></i></button>`);
    btns.push(`<button class="btn btn--outline btn--sm" data-status-action="${b.id}:no_show" title="Tidak Hadir"><i class="fa-solid fa-user-slash"></i></button>`);
  }
  return btns.join('');
}

function renderPagination(total) {
  const container = document.getElementById('bookings-pagination');
  if (!container) return;
  const totalPages = Math.ceil(total / 50) || 1;

  let html = `<button class="pagination__btn" data-page-delta="-1" ${bookingsPage <= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;
  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    html += `<button class="pagination__btn ${i === bookingsPage ? 'active' : ''}" data-page-go="${i}">${i}</button>`;
  }
  html += `<button class="pagination__btn" data-page-delta="1" ${bookingsPage >= totalPages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;
  container.innerHTML = html;
  container.querySelectorAll('[data-page-delta]').forEach(btn => {
    btn.addEventListener('click', () => changePage(parseInt(btn.dataset.pageDelta)));
  });
  container.querySelectorAll('[data-page-go]').forEach(btn => {
    btn.addEventListener('click', () => goToPage(parseInt(btn.dataset.pageGo)));
  });
}

async function updateStatus(id, status) {
  try {
    const res = await apiPut(`/api/admin/bookings/${id}/status`, { status });
    if (res.success) { showToast('Status diperbarui'); loadBookings(); loadDashboard(); }
    else showToast(res.message || 'Gagal', 'error');
  } catch { showToast('Gagal memperbarui status', 'error'); }
}

function changePage(delta) { bookingsPage = Math.max(1, bookingsPage + delta); loadBookings(); }
function goToPage(p) { bookingsPage = p; loadBookings(); }

// ============================================
// SERVICES MANAGEMENT
// ============================================
async function loadAdminServices() {
  try {
    const res = await apiGet('/api/admin/services');
    const container = document.getElementById('services-list');
    if (!container) return;

    if (!res.data || res.data.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-scissors"></i><p>Belum ada layanan terdaftar</p></div>';
      return;
    }

    container.innerHTML = res.data.map(s => `
      <div class="item-card ${!s.is_active ? 'inactive' : ''}">
        <div class="item-card__info">
          <h4>${esc(s.name)}</h4>
          <p>${esc(s.description || '')}</p>
          <div class="item-meta">
            <span><i class="fa-regular fa-clock"></i> ${s.duration_minutes}m</span>
            <span><i class="fa-solid fa-tag"></i> ${formatRupiah(s.price)}</span>
            <span class="badge ${s.is_active ? 'badge-active' : 'badge-inactive'}">${s.is_active ? 'Aktif' : 'Nonaktif'}</span>
          </div>
        </div>
        <div class="item-card__actions">
          <button class="btn btn--outline btn--sm" data-edit-service="${s.id}"><i class="fa-solid fa-pen"></i></button>
        </div>
      </div>
    `).join('');
    container.querySelectorAll('[data-edit-service]').forEach(btn => {
      btn.addEventListener('click', () => editService(btn.dataset.editService));
    });
  } catch { showToast('Gagal memuat layanan', 'error'); }
}

let editingServiceId = null;

function showServiceModal(id) {
  editingServiceId = id || null;
  document.getElementById('modal-service-title').textContent = id ? 'Edit Layanan' : 'Tambah Layanan';
  document.getElementById('service-name').value = '';
  document.getElementById('service-description').value = '';
  document.getElementById('service-duration').value = '30';
  document.getElementById('service-price').value = '';
  document.getElementById('service-category').value = 'potong';
  openModal('modal-service');
}

async function editService(id) {
  try {
    const res = await apiGet('/api/admin/services');
    const svc = (res.data || []).find(s => s.id === id);
    if (!svc) return;

    editingServiceId = id;
    document.getElementById('modal-service-title').textContent = 'Edit Layanan';
    document.getElementById('service-name').value = svc.name;
    document.getElementById('service-description').value = svc.description || '';
    document.getElementById('service-duration').value = svc.duration_minutes;
    document.getElementById('service-price').value = svc.price;
    document.getElementById('service-category').value = svc.category || 'potong';
    openModal('modal-service');
  } catch {}
}

async function saveService() {
  const data = {
    name: document.getElementById('service-name').value.trim(),
    description: document.getElementById('service-description').value.trim(),
    duration_minutes: parseInt(document.getElementById('service-duration').value),
    price: parseInt(document.getElementById('service-price').value),
    category: document.getElementById('service-category').value
  };

  if (!data.name || !data.price) { showToast('Nama dan harga wajib diisi', 'error'); return; }

  try {
    const res = editingServiceId
      ? await apiPut(`/api/admin/services/${editingServiceId}`, data)
      : await apiPost('/api/admin/services', data);
    if (res.success) { showToast('Layanan disimpan'); closeModal('modal-service'); loadAdminServices(); }
    else showToast(res.message || 'Gagal', 'error');
  } catch { showToast('Gagal menyimpan', 'error'); }
}

// ============================================
// BARBERS MANAGEMENT
// ============================================
async function loadAdminBarbers() {
  try {
    const res = await apiGet('/api/admin/barbers');
    const container = document.getElementById('barbers-list');
    if (!container) return;

    if (!res.data || res.data.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-tie"></i><p>Belum ada barber terdaftar</p></div>';
      return;
    }

    container.innerHTML = res.data.map(b => {
      const initials = b.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      return `
        <div class="item-card ${!b.is_active ? 'inactive' : ''}">
          <div style="display:flex;align-items:center;gap:12px;flex:1">
            <div class="avatar" style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:var(--bg-dark);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem">${initials}</div>
            <div class="item-card__info">
              <h4>${esc(b.name)}</h4>
              <p>${esc(b.speciality || 'Barber')}</p>
              <span class="badge ${b.is_active ? 'badge-active' : 'badge-inactive'}">${b.is_active ? 'Aktif' : 'Nonaktif'}</span>
            </div>
          </div>
          <div class="item-card__actions">
            <button class="btn btn--outline btn--sm" data-edit-barber="${b.id}"><i class="fa-solid fa-pen"></i></button>
          </div>
        </div>
      `;
    }).join('');
    container.querySelectorAll('[data-edit-barber]').forEach(btn => {
      btn.addEventListener('click', () => editBarber(btn.dataset.editBarber));
    });
  } catch { showToast('Gagal memuat barber', 'error'); }
}

let editingBarberId = null;

function showBarberModal(id) {
  editingBarberId = id || null;
  document.getElementById('modal-barber-title').textContent = id ? 'Edit Barber' : 'Tambah Barber';
  document.getElementById('barber-name').value = '';
  document.getElementById('barber-speciality').value = '';
  openModal('modal-barber');
}

async function editBarber(id) {
  try {
    const res = await apiGet('/api/admin/barbers');
    const b = (res.data || []).find(x => x.id === id);
    if (!b) return;

    editingBarberId = id;
    document.getElementById('modal-barber-title').textContent = 'Edit Barber';
    document.getElementById('barber-name').value = b.name;
    document.getElementById('barber-speciality').value = b.speciality || '';
    openModal('modal-barber');
  } catch {}
}

async function saveBarber() {
  const data = {
    name: document.getElementById('barber-name').value.trim(),
    speciality: document.getElementById('barber-speciality').value.trim()
  };

  if (!data.name) { showToast('Nama barber wajib diisi', 'error'); return; }

  try {
    const res = editingBarberId
      ? await apiPut(`/api/admin/barbers/${editingBarberId}`, data)
      : await apiPost('/api/admin/barbers', data);
    if (res.success) { showToast('Barber disimpan'); closeModal('modal-barber'); loadAdminBarbers(); }
    else showToast(res.message || 'Gagal', 'error');
  } catch { showToast('Gagal menyimpan', 'error'); }
}

// ============================================
// SETTINGS - OPERATING HOURS
// ============================================
const DAY_MAP = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

async function loadSettings() {
  try {
    const res = await apiGet('/api/admin/hours');
    if (!res.data) return;

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    res.data.forEach(h => {
      const dayName = dayNames[h.day_of_week];
      const row = document.querySelector(`tr[data-day="${dayName}"]`);
      if (!row) return;

      const openInput = row.querySelector('input[type="time"]:first-of-type');
      const closeInput = row.querySelector('input[type="time"]:last-of-type');
      const closedToggle = row.querySelector('input[type="checkbox"]');

      if (openInput) openInput.value = h.open_time?.slice(0, 5) || '09:00';
      if (closeInput) closeInput.value = h.close_time?.slice(0, 5) || '21:00';
      if (closedToggle) {
        closedToggle.checked = h.is_closed;
        if (openInput) openInput.disabled = h.is_closed;
        if (closeInput) closeInput.disabled = h.is_closed;
      }
    });
  } catch { showToast('Gagal memuat pengaturan', 'error'); }
}

async function saveHours() {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  try {
    for (const dayName of dayNames) {
      const row = document.querySelector(`tr[data-day="${dayName}"]`);
      if (!row) continue;

      const dayIndex = DAY_MAP[dayName];
      const openInput = row.querySelector('input[type="time"]:first-of-type');
      const closeInput = row.querySelector('input[type="time"]:last-of-type');
      const closedToggle = row.querySelector('input[type="checkbox"]');

      await apiPut(`/api/admin/hours/${dayIndex}`, {
        open_time: (openInput?.value || '09:00') + ':00',
        close_time: (closeInput?.value || '21:00') + ':00',
        is_closed: closedToggle?.checked || false
      });
    }
    showToast('Jam operasional disimpan');
  } catch { showToast('Gagal menyimpan', 'error'); }
}

// ============================================
// MODAL
// ============================================
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();

  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('btn-logout')?.addEventListener('click', logout);

  document.getElementById('filter-period')?.addEventListener('change', (e) => {
    const custom = document.getElementById('custom-date-range');
    if (custom) custom.classList.toggle('show', e.target.value === 'custom');
    loadCharts();
  });

  document.getElementById('booking-filter-status')?.addEventListener('change', () => { bookingsPage = 1; loadBookings(); });
  document.getElementById('booking-filter-date')?.addEventListener('change', () => { bookingsPage = 1; loadBookings(); });

  document.getElementById('btn-add-service')?.addEventListener('click', () => showServiceModal());
  document.getElementById('btn-save-service')?.addEventListener('click', saveService);
  document.getElementById('btn-add-barber')?.addEventListener('click', () => showBarberModal());
  document.getElementById('btn-save-barber')?.addEventListener('click', saveBarber);
  document.getElementById('btn-save-hours')?.addEventListener('click', saveHours);

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });

  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
  });

  document.querySelectorAll('.toggle-switch input[type="checkbox"]').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const row = toggle.closest('tr');
      if (row) row.querySelectorAll('input[type="time"]').forEach(i => i.disabled = toggle.checked);
    });
  });

  switchTab('dashboard');
});

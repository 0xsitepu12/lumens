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
  if (tabName === 'products') loadAdminProducts();
  if (tabName === 'settings') loadSettings();
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
  try {
    const period = document.getElementById('filter-period')?.value || 'month';
    const { start, end } = getDateRange(period);

    const res = await apiGet(`/api/admin/dashboard?start=${start}&end=${end}`);
    if (!res.success) return;
    const d = res.data;

    setText('stat-bookings', d.total || 0);
    setText('stat-revenue', formatRupiah(d.revenue || 0));
    setText('stat-pending', d.pending || 0);
    setText('stat-completed', d.completed || 0);

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
    renderRevenueChart(revenue.data || [], revenue.mode);
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
    const d = new Date(today);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
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
  gold: '#2a2a2a',
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
    x: { ticks: { color: '#555555' }, grid: { color: '#e0e0e0' } },
    y: { ticks: { color: '#555555', stepSize: 1 }, grid: { color: '#e0e0e0' }, beginAtZero: true }
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

function renderRevenueChart(data, mode) {
  const ctx = document.getElementById('chart-revenue');
  if (!ctx) return;
  if (charts.revenue) charts.revenue.destroy();

  const titleEl = ctx.closest('.chart-card')?.querySelector('.chart-card__title');

  if (mode === 'hourly') {
    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-chart-bar"></i> Pendapatan Per Jam';
    charts.revenue = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [
          {
            label: 'Omset',
            data: data.map(d => d.amount),
            backgroundColor: 'rgba(148,163,184,0.3)',
            borderColor: '#94a3b8',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Pendapatan Bersih',
            data: data.map(d => d.net ?? d.amount),
            backgroundColor: 'rgba(74,222,128,0.4)',
            borderColor: chartColors.green,
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        ...chartDefaults,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top', align: 'end', labels: { font: { size: 11 }, boxWidth: 10, padding: 12 } },
          tooltip: { callbacks: { label: c => c.dataset.label + ': ' + formatRupiah(c.parsed.y) } }
        },
        scales: {
          x: { ticks: { color: '#555555', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#555555', callback: v => formatRupiah(v) }, grid: { color: '#e0e0e0' }, beginAtZero: true }
        }
      }
    });
    return;
  }

  if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-chart-line"></i> Pendapatan Harian';
  charts.revenue = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => formatDateShort(d.date)),
      datasets: [
        {
          label: 'Omset',
          data: data.map(d => d.amount),
          borderColor: '#94a3b8',
          backgroundColor: 'rgba(148,163,184,0.08)',
          fill: true, tension: 0.3, pointRadius: 3,
          borderWidth: 2
        },
        {
          label: 'Pendapatan Bersih',
          data: data.map(d => d.net ?? d.amount),
          borderColor: chartColors.green,
          backgroundColor: 'rgba(74,222,128,0.12)',
          fill: true, tension: 0.3, pointRadius: 3,
          borderWidth: 2
        }
      ]
    },
    options: {
      ...chartDefaults,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', align: 'end', labels: { font: { size: 11 }, boxWidth: 10, padding: 12 } },
        tooltip: { callbacks: { label: c => c.dataset.label + ': ' + formatRupiah(c.parsed.y) } }
      },
      scales: {
        x: { ticks: { color: '#555555' }, grid: { color: '#e0e0e0' } },
        y: { ticks: { color: '#555555', callback: v => formatRupiah(v) }, grid: { color: '#e0e0e0' }, beginAtZero: true }
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
      plugins: { legend: { position: 'bottom', labels: { color: '#555555', padding: 12 } } }
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

function getBookingDateRange() {
  const period = document.getElementById('booking-filter-period')?.value || 'month';
  if (period === 'all') return { start: '', end: '' };
  if (period === 'custom') {
    return {
      start: document.getElementById('bk-filter-start')?.value || '',
      end: document.getElementById('bk-filter-end')?.value || ''
    };
  }
  return getDateRange(period);
}

async function loadBookings() {
  const status = document.getElementById('booking-filter-status')?.value || '';
  const { start, end } = getBookingDateRange();

  try {
    const res = await apiGet(`/api/admin/bookings?page=${bookingsPage}&status=${status}&start=${start}&end=${end}`);
    if (!res.success) return;

    const tbody = document.getElementById('bookings-table-body');
    if (!tbody) return;

    if (res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-calendar-xmark"></i><p>Tidak ada booking</p></div></td></tr>';
      return;
    }

    const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    let lastMonth = '';
    let html = '';
    res.data.forEach(b => {
      const monthKey = b.booking_date?.slice(0, 7) || '';
      if (monthKey && monthKey !== lastMonth) {
        const [y, m] = monthKey.split('-');
        html += '<tr><td colspan="6" style="background:var(--bg-input);padding:10px 16px;font-weight:700;font-size:0.85rem;color:var(--text-primary);border-bottom:2px solid var(--border)"><i class="fa-regular fa-calendar" style="margin-right:6px;color:var(--text-muted)"></i>' + BULAN[parseInt(m)-1] + ' ' + y + '</td></tr>';
        lastMonth = monthKey;
      }
      let orderedAt = '';
      if (b.created_at) {
        const ca = new Date(b.created_at);
        orderedAt = String(ca.getDate()).padStart(2,'0') + '/' + String(ca.getMonth()+1).padStart(2,'0') + '/' + String(ca.getFullYear()).slice(-2) + ' ' + ca.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      html += `
      <tr>
        <td>
          <div>${b.booking_time?.slice(0, 5)}</div>
          <small style="color: var(--text-muted)">${formatDateShort(b.booking_date)}</small>
        </td>
        <td>
          <div>${esc(b.customer_name)}</div>
          <small style="color: var(--text-muted)">${esc(b.customer_phone)}</small>
          ${orderedAt ? '<div style="font-size:0.65rem;color:#bbb;margin-top:2px">Dipesan ' + orderedAt + '</div>' : ''}
        </td>
        <td>${esc(b.services?.name || '-')}</td>
        <td>${esc(b.barbers?.name || '-')}</td>
        <td>${getStatusBadge(b.status)}</td>
        <td><div class="btn-group">${getBookingActions(b)}</div></td>
      </tr>`;
    });
    tbody.innerHTML = html;

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
  document.getElementById('service-modal').value = '0';
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
    document.getElementById('service-modal').value = svc.modal_price || 0;
    document.getElementById('service-category').value = svc.category || 'potong';
    openModal('modal-service');
  } catch {}
}

async function saveService() {
  const data = {
    name:             document.getElementById('service-name').value.trim(),
    description:      document.getElementById('service-description').value.trim(),
    duration_minutes: parseInt(document.getElementById('service-duration').value),
    price:            parseInt(document.getElementById('service-price').value),
    modal_price:      parseInt(document.getElementById('service-modal').value) || 0,
    category:         document.getElementById('service-category').value
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
const DAY_NAMES = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

async function loadAdminBarbers() {
  try {
    const [bRes, schedRes] = await Promise.all([
      apiGet('/api/admin/barbers'),
      apiGet('/api/admin/barbers/schedules').catch(() => ({ data: [] }))
    ]);
    const container = document.getElementById('barbers-list');
    if (!container) return;

    const barbers = bRes.data || [];
    if (!barbers.length) {
      container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-tie"></i><p>Belum ada barber terdaftar</p></div>';
      return;
    }

    const todayDay = new Date().getDay();

    container.innerHTML = barbers.map(b => {
      const initials = b.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

      // Cari jadwal hari ini dari schedules
      let shiftBadge = '';
      const allSchedules = schedRes.data || [];
      const todaySched = allSchedules.find(s => s.barber_id === b.id && s.day_of_week === todayDay);
      if (todaySched) {
        shiftBadge = todaySched.is_off
          ? `<span style="font-size:0.72rem;color:#dc2626;margin-top:4px;display:block"><i class="fa-solid fa-moon"></i> Libur hari ini</span>`
          : `<span style="font-size:0.72rem;color:#2563eb;margin-top:4px;display:block"><i class="fa-solid fa-clock"></i> ${todaySched.shift_start?.slice(0,5)} – ${todaySched.shift_end?.slice(0,5)}</span>`;
      }

      return `
        <div class="item-card ${!b.is_active ? 'inactive' : ''}">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
            <div style="width:44px;height:44px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;flex-shrink:0">${initials}</div>
            <div class="item-card__info" style="min-width:0">
              <h4>${esc(b.name)}</h4>
              <p style="color:var(--text-muted);font-size:0.8rem">${esc(b.speciality || 'Barber')}</p>
              ${shiftBadge}
              <span class="badge ${b.is_active ? 'badge-active' : 'badge-inactive'}" style="margin-top:6px">${b.is_active ? 'Aktif' : 'Nonaktif'}</span>
            </div>
          </div>
          <div class="item-card__actions" style="display:flex;flex-direction:column;gap:6px">
            <button class="btn btn--outline btn--sm" data-edit-barber="${b.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn--outline btn--sm" data-pw-barber="${b.id}" data-pw-name="${escAttr(b.name)}" title="Ganti Password"><i class="fa-solid fa-key"></i></button>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('[data-edit-barber]').forEach(btn => {
      btn.addEventListener('click', () => editBarber(btn.dataset.editBarber));
    });
    container.querySelectorAll('[data-pw-barber]').forEach(btn => {
      btn.addEventListener('click', () => openBarberPasswordModal(btn.dataset.pwBarber, btn.dataset.pwName));
    });
  } catch { showToast('Gagal memuat barber', 'error'); }
}

let editingBarberId = null;

function resetBarberScheduleForm() {
  for (let d = 0; d <= 6; d++) {
    const row = document.querySelector(`#barber-schedule-table tr[data-day="${d}"]`);
    if (!row) continue;
    row.querySelector(`input[name="start-${d}"]`).value = '09:00';
    row.querySelector(`input[name="end-${d}"]`).value   = '21:00';
    row.querySelector(`input[name="off-${d}"]`).checked = false;
    row.querySelectorAll('input[type="time"]').forEach(i => i.disabled = false);
  }
}

function fillBarberScheduleForm(schedules) {
  resetBarberScheduleForm();
  (schedules || []).forEach(s => {
    const d   = s.day_of_week;
    const row = document.querySelector(`#barber-schedule-table tr[data-day="${d}"]`);
    if (!row) return;
    row.querySelector(`input[name="start-${d}"]`).value   = s.shift_start?.slice(0,5) || '09:00';
    row.querySelector(`input[name="end-${d}"]`).value     = s.shift_end?.slice(0,5)   || '21:00';
    const off = row.querySelector(`input[name="off-${d}"]`);
    off.checked = !!s.is_off;
    row.querySelectorAll('input[type="time"]').forEach(i => i.disabled = !!s.is_off);
  });
}

function showBarberModal() {
  editingBarberId = null;
  document.getElementById('modal-barber-title').textContent = 'Tambah Barber';
  document.getElementById('barber-id').value = '';
  document.getElementById('barber-name').value = '';
  document.getElementById('barber-speciality').value = '';
  document.getElementById('barber-active').value = 'true';
  resetBarberScheduleForm();
  openModal('modal-barber');
}

async function editBarber(id) {
  try {
    const res = await apiGet(`/api/admin/barbers/${id}`);
    if (!res.success) return;
    const b = res.data;

    editingBarberId = id;
    document.getElementById('modal-barber-title').textContent = 'Edit Barber';
    document.getElementById('barber-id').value = id;
    document.getElementById('barber-name').value = b.name;
    document.getElementById('barber-speciality').value = b.speciality || '';
    document.getElementById('barber-active').value = b.is_active ? 'true' : 'false';
    fillBarberScheduleForm(b.schedules || []);
    openModal('modal-barber');
  } catch { showToast('Gagal memuat data barber', 'error'); }
}

async function saveBarber() {
  const name       = document.getElementById('barber-name').value.trim();
  const speciality = document.getElementById('barber-speciality').value.trim();
  const is_active  = document.getElementById('barber-active').value === 'true';

  if (!name) { showToast('Nama barber wajib diisi', 'error'); return; }

  try {
    // Simpan data barber
    const res = editingBarberId
      ? await apiPut(`/api/admin/barbers/${editingBarberId}`, { name, speciality, is_active })
      : await apiPost('/api/admin/barbers', { name, speciality, is_active });

    if (!res.success) { showToast(res.message || 'Gagal', 'error'); return; }

    const barberId = editingBarberId || res.data?.id;

    // Simpan jadwal jika ada barber id
    if (barberId) {
      const schedules = [];
      for (let d = 0; d <= 6; d++) {
        const row = document.querySelector(`#barber-schedule-table tr[data-day="${d}"]`);
        if (!row) continue;
        schedules.push({
          day_of_week: d,
          shift_start: (row.querySelector(`input[name="start-${d}"]`).value || '09:00') + ':00',
          shift_end:   (row.querySelector(`input[name="end-${d}"]`).value   || '21:00') + ':00',
          is_off:      row.querySelector(`input[name="off-${d}"]`).checked
        });
      }
      await apiPut(`/api/admin/barbers/${barberId}/schedule`, { schedules });
    }

    showToast('Barber disimpan');
    closeModal('modal-barber');
    loadAdminBarbers();
  } catch { showToast('Gagal menyimpan', 'error'); }
}

// ============================================
// SETTINGS - OPERATING HOURS
// ============================================
const DAY_MAP = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

async function loadSettings() {
  loadResetPasswordStatus();
  loadKasirList();
  loadStaffList();
  try {
    const res = await apiGet('/api/admin/hours');
    if (!res.data) return;

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    res.data.forEach(h => {
      const dayName = dayNames[h.day_of_week];
      const row = document.querySelector(`tr[data-day="${dayName}"]`);
      if (!row) return;

      const openInput = row.querySelector(`input[name="open-${dayName}"]`);
      const closeInput = row.querySelector(`input[name="close-${dayName}"]`);
      const closedToggle = row.querySelector(`input[name="closed-${dayName}"]`);

      if (openInput) openInput.value = h.open_time?.slice(0, 5) || '10:00';
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
      const openInput = row.querySelector(`input[name="open-${dayName}"]`);
      const closeInput = row.querySelector(`input[name="close-${dayName}"]`);
      const closedToggle = row.querySelector(`input[name="closed-${dayName}"]`);

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
// BARBER PASSWORD
// ============================================
let barberPwId = null;

function openBarberPasswordModal(id, name) {
  barberPwId = id;
  document.getElementById('barber-pw-name').textContent = name;
  document.getElementById('input-barber-new-pw').value = '';
  document.getElementById('input-barber-confirm-pw').value = '';
  openModal('modal-barber-password');
}

async function saveBarberPassword() {
  const newPw     = document.getElementById('input-barber-new-pw')?.value || '';
  const confirmPw = document.getElementById('input-barber-confirm-pw')?.value || '';
  if (!barberPwId) return;
  try {
    const data = await apiPut(`/api/admin/barbers/${barberPwId}/password`, { newPassword: newPw, confirmPassword: confirmPw });
    if (data.success) {
      showToast(data.message);
      closeModal('modal-barber-password');
    } else {
      showToast(data.message, 'error');
    }
  } catch { showToast('Gagal mengubah password', 'error'); }
}

// ============================================
// STAFF MANAGEMENT
// ============================================
async function loadStaffList() {
  const container = document.getElementById('staff-list');
  if (!container) return;
  try {
    const data = await apiGet('/api/admin/staff');
    const users = data.data || [];
    if (!users.length) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">Belum ada akun staff.</p>';
      return;
    }
    const ROLE_LABELS = { kasir: 'Kasir', barber: 'Barber' };
    container.innerHTML = users.map(u => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-elevated);border-radius:var(--radius-sm);gap:12px;">
        <div>
          <div style="font-weight:600;font-size:.875rem;">${esc(u.full_name || u.username)}</div>
          <div style="font-size:.75rem;color:var(--text-muted);">@${esc(u.username)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <select data-role-username="${escAttr(u.username)}" style="padding:5px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:.8rem;font-family:inherit;background:var(--bg-card);">
            <option value="kasir" ${u.role === 'kasir' ? 'selected' : ''}>Kasir</option>
            <option value="barber" ${u.role === 'barber' ? 'selected' : ''}>Barber</option>
          </select>
          <button class="btn btn--primary btn--sm" data-save-role="${escAttr(u.username)}" style="white-space:nowrap;font-size:.78rem;">Simpan</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-save-role]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const username = btn.dataset.saveRole;
        const sel = container.querySelector(`[data-role-username="${username}"]`);
        const role = sel?.value;
        if (!role) return;
        const res = await apiPut(`/api/admin/staff/${username}/role`, { role });
        if (res.success) { showToast(res.message); loadStaffList(); }
        else showToast(res.message, 'error');
      });
    });
  } catch { container.innerHTML = '<p style="color:var(--danger);font-size:.85rem;">Gagal memuat akun staff.</p>'; }
}

// ============================================
// KASIR PASSWORD
// ============================================
async function loadKasirList() {
  try {
    const data = await apiGet('/api/admin/kasir/list');
    const sel = document.getElementById('select-kasir-user');
    const noAccEl = document.getElementById('kasir-no-account');
    if (!sel) return;
    if (!data.data || data.data.length === 0) {
      sel.innerHTML = '<option value="">— Belum ada akun kasir —</option>';
      sel.disabled = true;
      if (noAccEl) noAccEl.style.display = '';
      return;
    }
    sel.disabled = false;
    if (noAccEl) noAccEl.style.display = 'none';
    sel.innerHTML = data.data.map(u =>
      `<option value="${u.username}">${u.full_name || u.username} (${u.username})</option>`
    ).join('');
  } catch { /* ignore */ }
}

async function createKasir() {
  const username = document.getElementById('input-kasir-username')?.value.trim();
  const fullName = document.getElementById('input-kasir-fullname')?.value.trim();
  const password = document.getElementById('input-kasir-create-pw')?.value;
  if (!username) return showToast('Username wajib diisi', 'error');
  try {
    const data = await fetch('/api/admin/kasir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, fullName, password })
    }).then(r => r.json());
    if (data.success) {
      showToast(data.message);
      document.getElementById('input-kasir-username').value = '';
      document.getElementById('input-kasir-fullname').value = '';
      document.getElementById('input-kasir-create-pw').value = '';
      loadKasirList();
    } else {
      showToast(data.message, 'error');
    }
  } catch { showToast('Gagal membuat akun kasir', 'error'); }
}

async function saveKasirPassword() {
  const username = document.getElementById('select-kasir-user')?.value;
  const newPw = document.getElementById('input-kasir-new-pw')?.value || '';
  const confirmPw = document.getElementById('input-kasir-confirm-pw')?.value || '';
  if (!username) return showToast('Pilih akun kasir terlebih dahulu', 'error');
  try {
    const data = await apiPut(`/api/admin/kasir/${username}/password`, { newPassword: newPw, confirmPassword: confirmPw });
    if (data.success) {
      showToast(data.message);
      document.getElementById('input-kasir-new-pw').value = '';
      document.getElementById('input-kasir-confirm-pw').value = '';
    } else {
      showToast(data.message, 'error');
    }
  } catch { showToast('Gagal mengubah password', 'error'); }
}

// ============================================
// RESET DASHBOARD
// ============================================
async function loadResetPasswordStatus() {
  try {
    const data = await apiGet('/api/admin/settings/reset-config');
    const statusEl = document.getElementById('reset-password-set-status');
    const wrapCurrent = document.getElementById('wrap-current-reset-pw');
    if (statusEl) statusEl.textContent = data.isSet ? '✅ Password reset sudah diatur' : '⚠️ Password reset belum diatur';
    if (wrapCurrent) wrapCurrent.style.display = data.isSet ? '' : 'none';
  } catch { /* ignore */ }
}

async function saveResetPassword() {
  const currentPw = document.getElementById('input-current-reset-pw')?.value || '';
  const newPw = document.getElementById('input-new-reset-pw')?.value || '';
  try {
    const data = await apiPost('/api/admin/settings/reset-password', { currentPassword: currentPw, newPassword: newPw });
    if (data.success) {
      showToast(data.message);
      document.getElementById('input-current-reset-pw').value = '';
      document.getElementById('input-new-reset-pw').value = '';
      loadResetPasswordStatus();
    } else {
      showToast(data.message, 'error');
    }
  } catch { showToast('Gagal menyimpan password', 'error'); }
}

async function confirmReset() {
  const pw = document.getElementById('input-reset-confirm-pw')?.value || '';
  const errEl = document.getElementById('reset-error-msg');
  errEl.style.display = 'none';
  try {
    const data = await apiPost('/api/admin/reset', { password: pw });
    if (data.success) {
      closeModal('modal-reset');
      document.getElementById('input-reset-confirm-pw').value = '';
      showToast('Dashboard berhasil direset', 'success');
      loadDashboard();
    } else {
      errEl.textContent = data.message;
      errEl.style.display = '';
    }
  } catch {
    errEl.textContent = 'Terjadi kesalahan. Coba lagi.';
    errEl.style.display = '';
  }
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
// EXPORT
// ============================================
function exportData(type) {
  const period = document.getElementById('filter-period')?.value || 'month';
  const { start, end } = getDateRange(period);
  window.open(`/api/admin/export/${type}?start=${start}&end=${end}`, '_blank');
}

// ============================================
// PRODUCTS MANAGEMENT
// ============================================
let editingProductId = null;

async function loadAdminProducts() {
  try {
    const res = await apiGet('/api/pos/products');
    const container = document.getElementById('products-list');
    if (!container) return;
    const products = res.data || [];

    if (!products.length) {
      container.innerHTML = '<div class="empty-state" style="text-align:center;padding:60px 20px;"><i class="fa-solid fa-mug-hot"></i><p>Belum ada produk</p></div>';
      return;
    }

    container.className = 'product-card-grid';
    container.innerHTML = products.map(p => {
      const stockClass = p.stock <= 0 ? 'badge-inactive' : p.stock <= 5 ? 'badge-warning' : 'badge-active';
      const stockLabel = p.stock <= 0 ? 'Habis' : 'Stok: ' + p.stock;
      const modal = p.modal_price || 0;
      const profit = p.price - modal;
      return '<div class="product-card-item">' +
        '<div class="product-card-top">' +
        '<div class="product-card-icon">' + (p.icon || '🥤') + '</div>' +
        '<div><div class="product-card-name">' + esc(p.name) + '</div>' +
        '<div class="product-card-cat">' + esc(p.category || 'minuman') + '</div></div>' +
        '</div>' +
        '<div class="product-card-prices">' +
        '<span class="product-card-sell">' + formatRupiah(p.price) + '</span>' +
        (modal ? '<span class="product-card-modal">Modal ' + formatRupiah(modal) + '</span>' : '') +
        '</div>' +
        (modal ? '<div class="product-card-profit"><i class="fa-solid fa-arrow-trend-up"></i> Profit ' + formatRupiah(profit) + '</div>' : '') +
        '<div class="product-card-bottom">' +
        '<span class="badge product-card-stock ' + stockClass + '">' + stockLabel + '</span>' +
        '<button class="btn btn--outline btn--sm product-card-edit" data-edit-product="' + p.id + '"><i class="fa-solid fa-pen"></i></button>' +
        '<button class="btn btn--outline btn--sm product-card-edit" style="color:var(--danger);border-color:var(--danger)" data-delete-product="' + p.id + '" data-delete-name="' + esc(p.name) + '"><i class="fa-solid fa-trash-can"></i></button>' +
        '</div></div>';
    }).join('');

    container.querySelectorAll('[data-edit-product]').forEach(function(btn) {
      btn.addEventListener('click', function() { editProduct(btn.dataset.editProduct); });
    });
    container.querySelectorAll('[data-delete-product]').forEach(function(btn) {
      btn.addEventListener('click', function() { deleteProduct(btn.dataset.deleteProduct, btn.dataset.deleteName); });
    });
  } catch { showToast('Gagal memuat produk', 'error'); }
}

function showProductModal(id) {
  editingProductId = id || null;
  document.getElementById('modal-product-title').textContent = id ? 'Edit Produk' : 'Tambah Produk';
  document.getElementById('product-name').value = '';
  document.getElementById('product-price').value = '';
  document.getElementById('product-modal-price').value = '0';
  document.getElementById('product-stock').value = '0';
  document.getElementById('product-category').value = 'minuman';
  document.getElementById('product-icon').value = '☕';
  selectIconPicker('☕');
  openModal('modal-product');
}

function selectIconPicker(icon) {
  document.querySelectorAll('.icon-pick').forEach(b => {
    b.classList.toggle('active', b.dataset.icon === icon);
  });
}

async function editProduct(id) {
  try {
    const res = await apiGet('/api/pos/products');
    const p = (res.data || []).find(function(x) { return x.id === id; });
    if (!p) return;
    editingProductId = id;
    document.getElementById('modal-product-title').textContent = 'Edit Produk';
    document.getElementById('product-name').value = p.name;
    document.getElementById('product-price').value = p.price;
    document.getElementById('product-modal-price').value = p.modal_price || 0;
    document.getElementById('product-stock').value = p.stock;
    document.getElementById('product-category').value = p.category || 'minuman';
    var icon = p.icon || '🥤';
    document.getElementById('product-icon').value = icon;
    selectIconPicker(icon);
    openModal('modal-product');
  } catch {}
}

let deleteProductId = null;

function deleteProduct(id, name) {
  deleteProductId = id;
  document.getElementById('delete-product-name').textContent = name;
  openModal('modal-delete-product');
}

async function confirmDeleteProduct() {
  if (!deleteProductId) return;
  var btn = document.getElementById('btn-confirm-delete-product');
  btn.disabled = true; btn.textContent = 'Menghapus...';
  try {
    var res = await apiDelete('/api/pos/products/' + deleteProductId);
    if (res.success) { showToast('Produk dihapus'); closeModal('modal-delete-product'); loadAdminProducts(); }
    else showToast(res.message || 'Gagal', 'error');
  } catch { showToast('Gagal menghapus', 'error'); }
  finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Hapus';
    deleteProductId = null;
  }
}

async function saveProduct() {
  var data = {
    name: document.getElementById('product-name').value.trim(),
    price: parseInt(document.getElementById('product-price').value),
    modal_price: parseInt(document.getElementById('product-modal-price').value) || 0,
    stock: parseInt(document.getElementById('product-stock').value) || 0,
    category: document.getElementById('product-category').value,
    icon: document.getElementById('product-icon').value.trim() || '🥤'
  };
  if (!data.name || !data.price) { showToast('Nama dan harga wajib diisi', 'error'); return; }

  try {
    var res = editingProductId
      ? await apiPut('/api/pos/products/' + editingProductId, data)
      : await apiPost('/api/pos/products', data);
    if (res.success) { showToast('Produk disimpan'); closeModal('modal-product'); loadAdminProducts(); }
    else showToast(res.message || 'Gagal', 'error');
  } catch { showToast('Gagal menyimpan', 'error'); }
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
  document.getElementById('btn-export-bookings')?.addEventListener('click', () => exportData('bookings'));
  document.getElementById('btn-export-revenue')?.addEventListener('click', () => exportData('revenue'));
  document.getElementById('btn-export-services')?.addEventListener('click', () => { window.open('/api/admin/export/services', '_blank'); });

  document.getElementById('filter-period')?.addEventListener('change', (e) => {
    const custom = document.getElementById('custom-date-range');
    if (custom) custom.classList.toggle('show', e.target.value === 'custom');
    loadDashboard();
  });

  document.getElementById('booking-filter-status')?.addEventListener('change', () => { bookingsPage = 1; loadBookings(); });
  document.getElementById('booking-filter-period')?.addEventListener('change', (e) => {
    document.getElementById('booking-custom-range').style.display = e.target.value === 'custom' ? '' : 'none';
    if (e.target.value !== 'custom') { bookingsPage = 1; loadBookings(); }
  });

  document.getElementById('btn-add-service')?.addEventListener('click', () => showServiceModal());
  document.getElementById('btn-save-service')?.addEventListener('click', saveService);
  document.getElementById('btn-add-product')?.addEventListener('click', () => showProductModal());
  document.getElementById('btn-save-product')?.addEventListener('click', saveProduct);
  document.getElementById('btn-confirm-delete-product')?.addEventListener('click', confirmDeleteProduct);
  document.querySelectorAll('.icon-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.icon-pick').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('product-icon').value = btn.dataset.icon;
    });
  });
  document.getElementById('btn-add-barber')?.addEventListener('click', () => showBarberModal());
  document.getElementById('btn-save-barber')?.addEventListener('click', saveBarber);
  document.getElementById('btn-save-hours')?.addEventListener('click', saveHours);
  document.getElementById('btn-save-barber-password')?.addEventListener('click', saveBarberPassword);
  document.getElementById('btn-save-kasir-password')?.addEventListener('click', saveKasirPassword);
  document.getElementById('btn-create-kasir')?.addEventListener('click', createKasir);
  document.getElementById('btn-save-reset-password')?.addEventListener('click', saveResetPassword);
  document.getElementById('btn-open-reset-modal')?.addEventListener('click', () => {
    document.getElementById('input-reset-confirm-pw').value = '';
    document.getElementById('reset-error-msg').style.display = 'none';
    openModal('modal-reset');
  });
  document.getElementById('btn-confirm-reset')?.addEventListener('click', confirmReset);

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

  // ============================================
  // DATE RANGE PICKER
  // ============================================
  (function() {
    var drMonth = new Date();
    var drStart = null;
    var drEnd = null;
    var drClickCount = 0;
    var MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var DAYS_HDR = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];

    var trigger = document.getElementById('daterange-trigger');
    var dropdown = document.getElementById('daterange-dropdown');
    var label = document.getElementById('daterange-label');

    function fmtD(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
    function fmtShort(d) { return d.getDate()+' '+MONTHS_ID[d.getMonth()].slice(0,3); }

    function renderDR() {
      var grid = document.getElementById('daterange-grid');
      var monthEl = document.getElementById('daterange-month');
      monthEl.textContent = MONTHS_ID[drMonth.getMonth()] + ' ' + drMonth.getFullYear();

      var html = DAYS_HDR.map(function(d) { return '<div class="dr-header">'+d+'</div>'; }).join('');
      var first = new Date(drMonth.getFullYear(), drMonth.getMonth(), 1);
      var startDay = first.getDay() === 0 ? 6 : first.getDay() - 1;
      var daysInMonth = new Date(drMonth.getFullYear(), drMonth.getMonth()+1, 0).getDate();
      var todayStr = fmtD(new Date());

      for (var i = 0; i < startDay; i++) html += '<div class="dr-day empty"></div>';
      for (var d = 1; d <= daysInMonth; d++) {
        var date = new Date(drMonth.getFullYear(), drMonth.getMonth(), d);
        var ds = fmtD(date);
        var cls = 'dr-day';
        if (ds === todayStr) cls += ' today';
        if (drStart && ds === fmtD(drStart)) cls += ' start';
        if (drEnd && ds === fmtD(drEnd)) cls += ' end';
        if (drStart && drEnd && date > drStart && date < drEnd) cls += ' in-range';
        html += '<div class="'+cls+'" data-date="'+ds+'">'+d+'</div>';
      }
      grid.innerHTML = html;

      grid.querySelectorAll('.dr-day:not(.empty)').forEach(function(el) {
        el.addEventListener('click', function() {
          var picked = new Date(el.dataset.date + 'T12:00:00');
          if (drClickCount === 0) {
            drStart = picked;
            drEnd = null;
            drClickCount = 1;
          } else {
            if (picked < drStart) { drEnd = drStart; drStart = picked; }
            else { drEnd = picked; }
            drClickCount = 0;
          }
          renderDR();
          updateDRLabel();
        });
      });
    }

    function updateDRLabel() {
      if (drStart && drEnd) {
        label.textContent = fmtShort(drStart) + '  →  ' + fmtShort(drEnd);
        label.style.color = 'var(--text-primary)';
      } else if (drStart) {
        label.textContent = fmtShort(drStart) + '  →  ...';
        label.style.color = 'var(--text-secondary)';
      } else {
        label.textContent = 'Pilih tanggal...';
        label.style.color = 'var(--text-muted)';
      }
    }

    if (trigger) {
      trigger.addEventListener('click', function() {
        dropdown.classList.toggle('open');
      });
    }
    document.getElementById('daterange-prev')?.addEventListener('click', function() {
      drMonth.setMonth(drMonth.getMonth() - 1); renderDR();
    });
    document.getElementById('daterange-next')?.addEventListener('click', function() {
      drMonth.setMonth(drMonth.getMonth() + 1); renderDR();
    });
    document.getElementById('daterange-clear')?.addEventListener('click', function() {
      drStart = null; drEnd = null; drClickCount = 0;
      updateDRLabel(); renderDR();
    });
    document.getElementById('daterange-apply')?.addEventListener('click', function() {
      if (!drStart || !drEnd) { showToast('Pilih tanggal awal dan akhir', 'error'); return; }
      document.getElementById('filter-date-start').value = fmtD(drStart);
      document.getElementById('filter-date-end').value = fmtD(drEnd);
      dropdown.classList.remove('open');
      loadDashboard();
    });

    if (dropdown) {
      dropdown.addEventListener('click', function(e) { e.stopPropagation(); });
    }
    document.addEventListener('click', function(e) {
      if (dropdown && e.target !== trigger && !trigger.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });

    renderDR();
  })();

  // ============================================
  // BOOKING DATE RANGE PICKER
  // ============================================
  (function() {
    var drMonth = new Date();
    var drStart = null;
    var drEnd = null;
    var drClickCount = 0;
    var MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var DAYS_HDR = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];

    var trigger = document.getElementById('bk-daterange-trigger');
    var dropdown = document.getElementById('bk-daterange-dropdown');
    var label = document.getElementById('bk-daterange-label');

    function fmtD(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
    function fmtShort(d) { return d.getDate()+' '+MONTHS_ID[d.getMonth()].slice(0,3); }

    function renderBkDR() {
      var grid = document.getElementById('bk-daterange-grid');
      var monthEl = document.getElementById('bk-daterange-month');
      monthEl.textContent = MONTHS_ID[drMonth.getMonth()] + ' ' + drMonth.getFullYear();
      var html = DAYS_HDR.map(function(d) { return '<div class="dr-header">'+d+'</div>'; }).join('');
      var first = new Date(drMonth.getFullYear(), drMonth.getMonth(), 1);
      var startDay = first.getDay() === 0 ? 6 : first.getDay() - 1;
      var daysInMonth = new Date(drMonth.getFullYear(), drMonth.getMonth()+1, 0).getDate();
      var todayStr = fmtD(new Date());
      for (var i = 0; i < startDay; i++) html += '<div class="dr-day empty"></div>';
      for (var d = 1; d <= daysInMonth; d++) {
        var date = new Date(drMonth.getFullYear(), drMonth.getMonth(), d);
        var ds = fmtD(date);
        var cls = 'dr-day';
        if (ds === todayStr) cls += ' today';
        if (drStart && ds === fmtD(drStart)) cls += ' start';
        if (drEnd && ds === fmtD(drEnd)) cls += ' end';
        if (drStart && drEnd && date > drStart && date < drEnd) cls += ' in-range';
        html += '<div class="'+cls+'" data-date="'+ds+'">'+d+'</div>';
      }
      grid.innerHTML = html;
      grid.querySelectorAll('.dr-day:not(.empty)').forEach(function(el) {
        el.addEventListener('click', function() {
          var picked = new Date(el.dataset.date + 'T12:00:00');
          if (drClickCount === 0) { drStart = picked; drEnd = null; drClickCount = 1; }
          else { if (picked < drStart) { drEnd = drStart; drStart = picked; } else { drEnd = picked; } drClickCount = 0; }
          renderBkDR(); updateBkLabel();
        });
      });
    }

    function updateBkLabel() {
      if (drStart && drEnd) { label.textContent = fmtShort(drStart) + '  →  ' + fmtShort(drEnd); label.style.color = 'var(--text-primary)'; }
      else if (drStart) { label.textContent = fmtShort(drStart) + '  →  ...'; label.style.color = 'var(--text-secondary)'; }
      else { label.textContent = 'Pilih tanggal...'; label.style.color = 'var(--text-muted)'; }
    }

    if (trigger) trigger.addEventListener('click', function() { dropdown.classList.toggle('open'); });
    if (dropdown) dropdown.addEventListener('click', function(e) { e.stopPropagation(); });
    document.getElementById('bk-daterange-prev')?.addEventListener('click', function() { drMonth.setMonth(drMonth.getMonth() - 1); renderBkDR(); });
    document.getElementById('bk-daterange-next')?.addEventListener('click', function() { drMonth.setMonth(drMonth.getMonth() + 1); renderBkDR(); });
    document.getElementById('bk-daterange-clear')?.addEventListener('click', function() { drStart = null; drEnd = null; drClickCount = 0; updateBkLabel(); renderBkDR(); });
    document.getElementById('bk-daterange-apply')?.addEventListener('click', function() {
      if (!drStart || !drEnd) { showToast('Pilih tanggal awal dan akhir', 'error'); return; }
      var startEl = document.getElementById('bk-filter-start');
      var endEl = document.getElementById('bk-filter-end');
      if (!startEl) { startEl = document.createElement('input'); startEl.type = 'hidden'; startEl.id = 'bk-filter-start'; document.body.appendChild(startEl); }
      if (!endEl) { endEl = document.createElement('input'); endEl.type = 'hidden'; endEl.id = 'bk-filter-end'; document.body.appendChild(endEl); }
      startEl.value = fmtD(drStart); endEl.value = fmtD(drEnd);
      dropdown.classList.remove('open');
      bookingsPage = 1; loadBookings();
    });
    document.addEventListener('click', function(e) {
      if (dropdown && e.target !== trigger && !trigger?.contains(e.target)) dropdown.classList.remove('open');
    });
    renderBkDR();
  })();

  switchTab('dashboard');
});

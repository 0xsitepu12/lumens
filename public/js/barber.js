let currentPeriod = 'today';
let perfChart = null;

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
  month: 'Bulan ini',
  all:   'Semua waktu'
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
  document.getElementById('stat-net-revenue').textContent = fmt(data.netRevenue ?? data.revenue);
  document.getElementById('stat-revenue').textContent     = fmt(data.revenue);
  document.getElementById('stat-period-label').textContent = PERIOD_LABEL[currentPeriod];
  document.getElementById('stat-total').textContent     = data.total;
  document.getElementById('stat-completed').textContent = data.completed;
  document.getElementById('stat-confirmed').textContent = data.confirmed;
  document.getElementById('stat-pending').textContent   = data.pending;
  updateRateCircle(data.rate);
}

function renderChart(bookings) {
  const card  = document.getElementById('chart-card');
  const title = document.getElementById('chart-title');
  const canvas = document.getElementById('perf-chart');
  if (!canvas) return;

  // Hari Ini: sembunyikan chart (sedikit data)
  if (currentPeriod === 'today') { card.style.display = 'none'; return; }
  card.style.display = '';

  // Group data
  const groups = {};
  bookings.forEach(b => {
    let key;
    if (currentPeriod === 'all') {
      key = b.booking_date?.slice(0, 7);
    } else {
      key = b.booking_date;
    }
    if (!key) return;
    if (!groups[key]) groups[key] = { omset: 0, net: 0, count: 0 };
    groups[key].count++;
    if (b.status === 'completed') {
      const modal = b.services?.modal_price || 0;
      groups[key].omset += b.total_price || 0;
      groups[key].net   += (b.total_price || 0) - modal;
    }
  });

  const labels  = Object.keys(groups).sort();
  const omset   = labels.map(k => groups[k].omset);
  const net     = labels.map(k => groups[k].net);
  const counts  = labels.map(k => groups[k].count);

  // Format label
  const fmtLabel = lbl => {
    if (currentPeriod === 'all') {
      const [y, m] = lbl.split('-');
      return new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    }
    const d = new Date(lbl + 'T00:00:00');
    return currentPeriod === 'month'
      ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      : d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
  };

  const displayLabels = labels.map(fmtLabel);

  const CHART_TITLES = { week: 'Pendapatan 7 Hari', month: 'Pendapatan Bulan Ini', all: 'Pendapatan per Bulan' };
  if (title) title.textContent = CHART_TITLES[currentPeriod] || 'Grafik Pendapatan';

  if (perfChart) { perfChart.destroy(); perfChart = null; }

  perfChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: displayLabels,
      datasets: [
        {
          label: 'Omset',
          data: omset,
          borderColor: '#94a3b8',
          backgroundColor: 'rgba(148,163,184,0.08)',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Pendapatan Bersih',
          data: net,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22,163,74,0.1)',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Booking',
          data: counts,
          borderColor: '#2563eb',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: false,
          yAxisID: 'y2',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { font: { size: 10 }, boxWidth: 10, boxHeight: 10, padding: 10,
            generateLabels: chart => chart.data.datasets.map((ds, i) => ({
              text: ds.label,
              fillStyle: ds.borderColor,
              strokeStyle: ds.borderColor,
              hidden: false,
              index: i
            }))
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.datasetIndex === 2) return ctx.dataset.label + ': ' + ctx.parsed.y + ' booking';
              return ctx.dataset.label + ': Rp ' + ctx.parsed.y.toLocaleString('id-ID');
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, color: '#999', maxRotation: 0 }
        },
        y: {
          position: 'left',
          grid: { color: '#f0f0f0' },
          ticks: {
            font: { size: 10 }, color: '#555',
            callback: v => v >= 1000 ? (v/1000).toFixed(0) + 'k' : v
          }
        },
        y2: {
          position: 'right',
          grid: { display: false },
          ticks: { font: { size: 10 }, color: '#2563eb', stepSize: 1 },
          min: 0
        }
      }
    }
  });
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
    renderChart(data.data.bookings);
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

// ============================================
// UBAH PASSWORD
// ============================================
function openPwModal() {
  document.getElementById('pw-old').value = '';
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-confirm').value = '';
  document.getElementById('pw-error').style.display = 'none';
  document.getElementById('pw-overlay').classList.add('show');
}

function closePwModal() {
  document.getElementById('pw-overlay').classList.remove('show');
}

async function submitChangePassword() {
  const oldPw     = document.getElementById('pw-old').value;
  const newPw     = document.getElementById('pw-new').value;
  const confirmPw = document.getElementById('pw-confirm').value;
  const errEl     = document.getElementById('pw-error');
  const btn       = document.getElementById('pw-submit');

  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    const res = await fetch('/api/barber/change-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw, confirmPassword: confirmPw })
    });
    const data = await res.json();
    if (data.success) {
      closePwModal();
      // Tampilkan notif sukses sederhana
      const toast = document.createElement('div');
      toast.textContent = data.message;
      toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:10px;font-size:.85rem;font-weight:600;z-index:999;animation:none';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } else {
      errEl.textContent = data.message;
      errEl.style.display = '';
    }
  } catch {
    errEl.textContent = 'Terjadi kesalahan. Coba lagi.';
    errEl.style.display = '';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan Password';
  }
}

// ============================================
// ATUR JADWAL
// ============================================
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

async function openScheduleModal() {
  const overlay = document.getElementById('sched-overlay');
  const body = document.getElementById('sched-body');
  const errEl = document.getElementById('sched-error');
  errEl.style.display = 'none';

  body.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#999"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</td></tr>';
  overlay.classList.add('show');

  try {
    const res = await fetch('/api/barber/me', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) { errEl.textContent = data.message; errEl.style.display = ''; return; }

    const schedRes = await fetch('/api/barber/schedule', { credentials: 'include' });
    const schedData = await schedRes.json();

    const schedules = schedData.data?.schedules || [];

    body.innerHTML = DAYS.map((day, i) => {
      const s = schedules.find(sc => sc.day_of_week === i);
      const start = s?.shift_start?.slice(0, 5) || '10:00';
      const end = s?.shift_end?.slice(0, 5) || '21:00';
      const off = s?.is_off ?? false;
      return `<tr data-day="${i}" style="border-bottom:1px solid #f0f0f0">
        <td style="padding:10px 4px;font-weight:500">${day}</td>
        <td style="padding:10px 4px;text-align:center"><input type="time" name="start-${i}" value="${start}" style="padding:6px;border:1px solid #e0e0e0;border-radius:6px;font-family:inherit;font-size:0.82rem" ${off ? 'disabled' : ''}></td>
        <td style="padding:10px 4px;text-align:center"><input type="time" name="end-${i}" value="${end}" style="padding:6px;border:1px solid #e0e0e0;border-radius:6px;font-family:inherit;font-size:0.82rem" ${off ? 'disabled' : ''}></td>
        <td style="padding:10px 4px;text-align:center"><input type="checkbox" name="off-${i}" ${off ? 'checked' : ''} style="width:18px;height:18px;accent-color:#1a1a1a"></td>
      </tr>`;
    }).join('');

    body.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const day = cb.name.split('-')[1];
        const row = body.querySelector(`tr[data-day="${day}"]`);
        row.querySelectorAll('input[type="time"]').forEach(t => t.disabled = cb.checked);
      });
    });
  } catch {
    errEl.textContent = 'Gagal memuat jadwal.';
    errEl.style.display = '';
  }
}

function closeScheduleModal() {
  document.getElementById('sched-overlay').classList.remove('show');
}

async function submitSchedule() {
  const body = document.getElementById('sched-body');
  const errEl = document.getElementById('sched-error');
  const btn = document.getElementById('sched-submit');
  errEl.style.display = 'none';

  const schedules = [];
  for (let i = 0; i < 7; i++) {
    const row = body.querySelector(`tr[data-day="${i}"]`);
    if (!row) continue;
    schedules.push({
      day_of_week: i,
      shift_start: row.querySelector(`input[name="start-${i}"]`).value + ':00',
      shift_end: row.querySelector(`input[name="end-${i}"]`).value + ':00',
      is_off: row.querySelector(`input[name="off-${i}"]`).checked
    });
  }

  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    const res = await fetch('/api/barber/schedule', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ schedules })
    });
    const data = await res.json();
    if (data.success) {
      closeScheduleModal();
      const toast = document.createElement('div');
      toast.textContent = 'Jadwal berhasil disimpan';
      toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:10px;font-size:.85rem;font-weight:600;z-index:999';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } else {
      errEl.textContent = data.message || 'Gagal menyimpan jadwal.';
      errEl.style.display = '';
    }
  } catch {
    errEl.textContent = 'Terjadi kesalahan.';
    errEl.style.display = '';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan Jadwal';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();

  document.querySelectorAll('.period-tab').forEach(btn => {
    btn.addEventListener('click', () => switchPeriod(btn.dataset.period));
  });

  document.getElementById('btn-refresh')?.addEventListener('click', loadDashboard);
  document.getElementById('btn-schedule')?.addEventListener('click', openScheduleModal);
  document.getElementById('sched-submit')?.addEventListener('click', submitSchedule);
  document.getElementById('sched-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('sched-overlay')) closeScheduleModal();
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  });

  document.getElementById('btn-change-pw')?.addEventListener('click', openPwModal);
  document.getElementById('pw-submit')?.addEventListener('click', submitChangePassword);
  document.getElementById('pw-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('pw-overlay')) closePwModal();
  });

  await loadDashboard();
});

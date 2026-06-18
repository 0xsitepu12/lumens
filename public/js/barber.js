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
  document.getElementById('stat-revenue').textContent  = fmt(data.revenue);
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
      key = b.booking_date?.slice(0, 7); // YYYY-MM
    } else {
      key = b.booking_date; // YYYY-MM-DD
    }
    if (!key) return;
    if (!groups[key]) groups[key] = { revenue: 0, count: 0 };
    groups[key].count++;
    if (b.status === 'completed') groups[key].revenue += b.total_price || b.services?.price || 0;
  });

  const labels  = Object.keys(groups).sort();
  const revenue = labels.map(k => groups[k].revenue);
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
    type: 'bar',
    data: {
      labels: displayLabels,
      datasets: [
        {
          label: 'Pendapatan (Rp)',
          data: revenue,
          backgroundColor: 'rgba(22,163,74,0.15)',
          borderColor: '#16a34a',
          borderWidth: 2,
          borderRadius: 6,
          yAxisID: 'y',
        },
        {
          label: 'Booking',
          data: counts,
          type: 'line',
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.1)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#2563eb',
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
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ctx.datasetIndex === 0
              ? 'Rp ' + ctx.parsed.y.toLocaleString('id-ID')
              : ctx.parsed.y + ' booking'
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
            font: { size: 10 },
            color: '#16a34a',
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

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();

  document.querySelectorAll('.period-tab').forEach(btn => {
    btn.addEventListener('click', () => switchPeriod(btn.dataset.period));
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

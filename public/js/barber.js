let currentPeriod = 'today';
let calWeekStart;
let calSelectedDate;
let bookingDates = {};

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

const DAYS_SHORT = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function fmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function getWeekStart(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  const title = document.getElementById('cal-title');
  if (!grid) return;

  const today = todayStr();
  const weekEnd = new Date(calWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const startMonth = MONTHS_SHORT[calWeekStart.getMonth()];
  const endMonth = MONTHS_SHORT[weekEnd.getMonth()];
  if (startMonth === endMonth) {
    title.textContent = calWeekStart.getDate() + ' - ' + weekEnd.getDate() + ' ' + endMonth + ' ' + weekEnd.getFullYear();
  } else {
    title.textContent = calWeekStart.getDate() + ' ' + startMonth + ' - ' + weekEnd.getDate() + ' ' + endMonth;
  }

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(calWeekStart);
    d.setDate(d.getDate() + i);
    const dateStr = fmtDate(d);
    const isToday = dateStr === today ? ' today' : '';
    const isSelected = dateStr === calSelectedDate ? ' selected' : '';
    const dot = bookingDates[dateStr] ? '<span class="cal-dot"></span>' : '';

    html += '<button class="cal-cell' + isToday + isSelected + '" data-date="' + dateStr + '">'
      + '<span class="cal-day">' + DAYS_SHORT[d.getDay()] + '</span>'
      + '<span class="cal-num">' + d.getDate() + '</span>'
      + dot
      + '</button>';
  }

  grid.innerHTML = html;

  grid.querySelectorAll('[data-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      calSelectedDate = btn.dataset.date;
      document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
      currentPeriod = 'date';
      loadDashboard();
      renderCalendar();
    });
  });
}

function calPrev() {
  calWeekStart.setDate(calWeekStart.getDate() - 7);
  renderCalendar();
}

function calNext() {
  calWeekStart.setDate(calWeekStart.getDate() + 7);
  renderCalendar();
}

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
    const orderedAt = b.created_at ? new Date(b.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

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
          ${orderedAt ? '<div style="font-size:0.6rem;color:#bbb;margin-top:2px">Dipesan ' + orderedAt + '</div>' : ''}
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
    let url = `/api/barber/stats?period=${currentPeriod}`;
    if (currentPeriod === 'date' && calSelectedDate) {
      url = `/api/barber/stats?period=date&date=${calSelectedDate}`;
    }

    const res  = await fetch(url, { credentials: 'include' });
    const data = await res.json();

    if (!data.success) {
      showError(data.message || 'Gagal memuat data');
      return;
    }

    const barber = data.data.barber;
    const nameEl = document.getElementById('hdr-name');
    const avatarEl = document.getElementById('hdr-avatar');
    if (nameEl) nameEl.textContent = barber.name;
    if (avatarEl) avatarEl.textContent = barber.name.charAt(0).toUpperCase();

    if (currentPeriod === 'date') {
      const d = new Date(calSelectedDate + 'T12:00:00');
      document.getElementById('stat-period-label').textContent = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
    }

    bookingDates = {};
    (data.data.bookings || []).forEach(b => {
      if (b.booking_date) bookingDates[b.booking_date] = true;
    });
    renderCalendar();

    renderStats(data.data);
    renderList(data.data.bookings);

  } catch {
    showError('Terjadi kesalahan. Coba refresh halaman.');
  }
}

function switchPeriod(period) {
  currentPeriod = period;
  calSelectedDate = null;
  document.querySelectorAll('.period-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.period === period);
  });
  renderCalendar();
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

  calWeekStart = getWeekStart();
  calSelectedDate = null;
  renderCalendar();

  document.getElementById('cal-prev')?.addEventListener('click', calPrev);
  document.getElementById('cal-next')?.addEventListener('click', calNext);

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

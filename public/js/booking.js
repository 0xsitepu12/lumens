const state = {
  step: 1,
  services: [],
  barbers: [],
  selectedService: null,
  selectedBarber: null,
  selectedDate: null,
  selectedTime: null
};

async function init() {
  try {
    const res = await apiGet('/api/booking/services');
    state.services = res.data || [];
    renderServices();
    renderDatePicker();
    updateStepIndicator();
  } catch {
    showToast('Gagal memuat data. Coba refresh halaman.', 'error');
  }
}

// ============================================
// STEP 1: LAYANAN
// ============================================
function renderServices() {
  const container = document.getElementById('service-list');
  if (!container) return;

  const CAT_ORDER = ['potong', 'perawatan', 'warna', 'styling', 'cukur', 'paket', 'lainnya'];
  const CAT_NAMES = {
    potong:    'Potong Rambut',
    perawatan: 'Perawatan',
    warna:     'Pewarnaan',
    styling:   'Styling',
    cukur:     'Cukur',
    paket:     'Paket',
    lainnya:   'Lainnya',
  };

  // Group by category
  const grouped = {};
  state.services.forEach(s => {
    const cat = s.category || 'lainnya';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  });

  // Render dalam urutan tetap, kategori tanpa isi tidak ditampilkan
  let html = '';
  const orderedKeys = [
    ...CAT_ORDER.filter(k => grouped[k]),
    ...Object.keys(grouped).filter(k => !CAT_ORDER.includes(k))
  ];

  orderedKeys.forEach(cat => {
    html += `<div class="svc-group-label">${CAT_NAMES[cat] || cat}</div>`;
    html += grouped[cat].map(s => `
      <div class="svc-row" data-id="${s.id}">
        <span class="svc-row-name">${esc(s.name)}</span>
        <span class="svc-row-price">${formatRupiah(s.price)}</span>
      </div>
    `).join('');
  });

  container.innerHTML = html;
  container.querySelectorAll('.svc-row').forEach(c => {
    c.addEventListener('click', () => selectService(c.dataset.id));
  });
}

function selectService(id) {
  state.selectedService = state.services.find(s => s.id === id);
  document.querySelectorAll('#service-list .svc-row').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });
  goToStep(2);
}

// ============================================
// STEP 2: JADWAL (tanggal + waktu)
// ============================================
function renderDatePicker() {
  const container = document.getElementById('date-picker');
  if (!container) return;

  const now = new Date();
  const startDay = (now.getHours() >= 20 && now.getMinutes() >= 30) || now.getHours() >= 21 ? 1 : 0;
  let html = '';
  let currentMonth = -1;

  for (let i = startDay; i < startDay + 28; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const dayShort = DAYS_SHORT[d.getDay()];
    const dateNum = d.getDate();
    const month = d.getMonth();

    if (month !== currentMonth) {
      currentMonth = month;
      const monthName = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      html += `<div class="date-month-label">${monthName}</div>`;
    }

    html += `
      <div class="date-cell" data-date="${dateStr}">
        <span class="date-cell-day">${dayShort}</span>
        <span class="date-cell-num">${dateNum}</span>
      </div>
    `;
  }
  container.innerHTML = html;
  container.querySelectorAll('.date-cell').forEach(c => {
    c.addEventListener('click', () => selectDate(c.dataset.date));
  });
}

async function selectDate(dateStr) {
  state.selectedDate = dateStr;
  state.selectedTime = null;
  state.selectedBarber = null;

  document.querySelectorAll('.date-item').forEach(c => {
    c.classList.toggle('selected', c.dataset.date === dateStr);
  });

  goToStep(3);
}

function selectTime(time) {
  state.selectedTime = time;
  document.querySelectorAll('.time-slot').forEach(s => {
    s.classList.toggle('selected', s.dataset.time === time);
  });
  updateNavButtons();
}

// ============================================
// STEP 3: STYLIST (filtered by selected date)
// ============================================
async function loadBarbersForDate() {
  if (!state.selectedDate) return;

  const container = document.getElementById('barber-list');
  container.innerHTML = '<div style="text-align:center;padding:1rem"><i class="fa-solid fa-spinner fa-spin" style="color:var(--text-muted)"></i></div>';

  try {
    const res = await apiGet(`/api/booking/barbers?date=${state.selectedDate}`);
    state.barbers = res.data || [];

    if (state.barbers.length === 0) {
      container.innerHTML = '<p class="text-muted" style="text-align:center;padding:1rem">Tidak ada stylist tersedia di hari ini</p>';
      return;
    }

    container.innerHTML = state.barbers.map(b => `
      <div class="stylist-cell" data-id="${b.id}">
        <span class="stylist-name">${esc(b.name)}</span>
        <span class="stylist-spec">${b.shift_start?.slice(0,5)} - ${b.shift_end?.slice(0,5)}</span>
      </div>
    `).join('');

    container.querySelectorAll('.stylist-cell').forEach(c => {
      c.addEventListener('click', () => selectBarber(c.dataset.id));
    });
  } catch {
    container.innerHTML = '<p class="text-muted" style="text-align:center;padding:1rem">Gagal memuat stylist</p>';
  }
}

async function selectBarber(id) {
  state.selectedBarber = state.barbers.find(b => b.id === id);
  state.selectedTime = null;

  document.querySelectorAll('#barber-list .stylist-cell').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });

  const section = document.getElementById('time-slots-section');
  if (section) section.style.display = '';

  await loadTimeSlotsForBarber();
  updateNavButtons();
}

async function loadTimeSlotsForBarber() {
  if (!state.selectedBarber || !state.selectedDate || !state.selectedService) return;

  const slotsContainer = document.getElementById('time-slots');
  slotsContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1rem"><i class="fa-solid fa-spinner fa-spin" style="color:var(--text-muted)"></i></div>';

  try {
    const res = await apiGet(`/api/booking/slots?date=${state.selectedDate}&barber_id=${state.selectedBarber.id}&duration=${state.selectedService.duration_minutes}`);

    if (res.data && res.data.length > 0) {
      slotsContainer.innerHTML = res.data.map(s => `
        <div class="time-slot ${s.available ? 'available' : 'unavailable'}" data-time="${s.time}">${s.time}</div>
      `).join('');
      slotsContainer.querySelectorAll('.time-slot.available').forEach(s => {
        s.addEventListener('click', () => selectTime(s.dataset.time));
      });
    } else {
      slotsContainer.innerHTML = '<p class="text-muted" style="grid-column:1/-1;text-align:center;padding:1rem">Tidak ada slot tersedia</p>';
    }
  } catch {
    slotsContainer.innerHTML = '<p class="text-muted" style="grid-column:1/-1;text-align:center">Gagal memuat jadwal</p>';
  }
}

// ============================================
// STEP 4: KONFIRMASI
// ============================================
function renderSummary() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('summary-service', state.selectedService?.name || '-');
  set('summary-barber', state.selectedBarber?.name || '-');
  set('summary-date', state.selectedDate ? formatDate(state.selectedDate) : '-');
  set('summary-time', state.selectedTime || '-');
  set('summary-duration', (state.selectedService?.duration_minutes || '-') + ' menit');
  set('summary-price', formatRupiah(state.selectedService?.price || 0));
}

async function confirmBooking() {
  const name = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();

  if (!name || !phone) { showToast('Nama dan No. HP wajib diisi', 'error'); return; }

  const btn = document.getElementById('btn-confirm');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

  try {
    const res = await apiPost('/api/booking/create', {
      customer_name: name,
      customer_phone: phone,
      customer_email: null,
      service_id: state.selectedService.id,
      barber_id: state.selectedBarber.id,
      booking_date: state.selectedDate,
      booking_time: state.selectedTime,
      notes: null
    });

    if (res.success) {
      renderSuccess(res.data);
      goToStep(5);
    } else {
      showToast(res.message || 'Booking gagal', 'error');
    }
  } catch {
    showToast('Terjadi kesalahan. Coba lagi.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Konfirmasi Booking';
  }
}

function renderSuccess(booking) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('success-booking-id', booking.id?.slice(0, 8).toUpperCase() || '-');
  set('success-service', state.selectedService?.name || '-');
  set('success-barber', state.selectedBarber?.name || '-');
  set('success-date', formatDate(state.selectedDate));
  set('success-time', state.selectedTime);

  const waBtn = document.getElementById('btn-wa');
  if (waBtn) {
    const name = document.getElementById('customer-name').value.trim();
    const msg = encodeURIComponent(
      `Halo LUMEN'S STUDIO,\n` +
      `Saya ${name} sudah booking:\n` +
      `📋 ${state.selectedService?.name}\n` +
      `💇 Stylist: ${state.selectedBarber?.name}\n` +
      `📅 ${formatDate(state.selectedDate)}\n` +
      `⏰ ${state.selectedTime}\n` +
      `🆔 ${booking.id?.slice(0, 8).toUpperCase()}\n\n` +
      `Mohon konfirmasinya. Terima kasih!`
    );
    waBtn.href = `https://wa.me/6281367586550?text=${msg}`;
  }
}

// ============================================
// NAVIGATION
// ============================================
function goToStep(step) {
  if (step < 1) return;

  // Validation
  if (step > state.step) {
    if (state.step === 1 && !state.selectedService) { showToast('Pilih layanan terlebih dahulu', 'error'); return; }
    if (state.step === 2 && !state.selectedDate) { showToast('Pilih tanggal terlebih dahulu', 'error'); return; }
    if (state.step === 3 && (!state.selectedBarber || !state.selectedTime)) { showToast('Pilih stylist dan waktu', 'error'); return; }
  }

  state.step = step;

  // Load data for entering step
  if (step === 3) loadBarbersForDate();
  if (step === 4) renderSummary();

  // Show/hide panels
  document.querySelectorAll('.wizard-panel').forEach(el => {
    const s = el.dataset.step;
    if (s === 'success') {
      el.style.display = step === 5 ? '' : 'none';
      el.classList.toggle('active', step === 5);
    } else {
      el.style.display = parseInt(s) === step ? '' : 'none';
      el.classList.toggle('active', parseInt(s) === step);
    }
  });

  const nav = document.getElementById('wizard-nav');
  if (nav) nav.style.display = (step <= 2 || step === 5) ? 'none' : '';

  const stepsEl = document.getElementById('wizard-steps');
  if (stepsEl) stepsEl.style.display = step === 5 ? 'none' : '';

  const btnBack = document.getElementById('btn-back');
  if (btnBack) btnBack.style.display = step <= 1 || step >= 5 ? 'none' : '';

  const btnNext = document.getElementById('btn-next');
  if (btnNext) btnNext.style.display = step >= 4 ? 'none' : '';

  const btnConfirm = document.getElementById('btn-confirm');
  if (btnConfirm) btnConfirm.style.display = step === 4 ? '' : 'none';

  updateStepIndicator();
  updateNavButtons();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStepIndicator() {
  document.querySelectorAll('[data-step-indicator]').forEach(el => {
    const s = parseInt(el.dataset.stepIndicator);
    el.classList.remove('active', 'completed');
    if (s === state.step) el.classList.add('active');
    if (s < state.step) el.classList.add('completed');
  });
}

function updateNavButtons() {
  const btnNext = document.getElementById('btn-next');
  if (!btnNext) return;
  if (state.step === 1) btnNext.disabled = !state.selectedService;
  else if (state.step === 2) btnNext.disabled = !state.selectedDate;
  else if (state.step === 3) btnNext.disabled = !state.selectedBarber || !state.selectedTime;
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  init();
  document.getElementById('btn-next')?.addEventListener('click', () => goToStep(state.step + 1));
  document.getElementById('btn-back')?.addEventListener('click', () => goToStep(state.step - 1));
  document.getElementById('btn-confirm')?.addEventListener('click', confirmBooking);

  const nameInput = document.getElementById('customer-name');
  const phoneInput = document.getElementById('customer-phone');
  if (nameInput && phoneInput) {
    const checkForm = () => {
      const btn = document.getElementById('btn-confirm');
      if (btn) btn.disabled = !nameInput.value.trim() || !phoneInput.value.trim();
    };
    nameInput.addEventListener('input', checkForm);
    phoneInput.addEventListener('input', checkForm);
  }
});

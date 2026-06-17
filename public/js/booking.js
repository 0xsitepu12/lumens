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
    const [servicesRes, barbersRes] = await Promise.all([
      apiGet('/api/booking/services'),
      apiGet('/api/booking/barbers')
    ]);
    state.services = servicesRes.data || [];
    state.barbers = barbersRes.data || [];
    renderServices();
    renderBarbers();
    renderDatePicker();
    updateStepIndicator();
  } catch {
    showToast('Gagal memuat data. Coba refresh halaman.', 'error');
  }
}

function renderServices() {
  const container = document.getElementById('service-list');
  if (!container) return;
  container.innerHTML = state.services.map(s => `
    <div class="service-card" data-id="${s.id}" onclick="selectService('${s.id}')">
      <div class="service-card-header">
        <div class="service-card-icon"><i class="fa-solid fa-scissors"></i></div>
        <div class="service-card-price">${formatRupiah(s.price)}</div>
      </div>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description || '')}</p>
      <div class="service-card-meta">
        <span><i class="fa-regular fa-clock"></i> ${s.duration_minutes} menit</span>
      </div>
    </div>
  `).join('');
}

function renderBarbers() {
  const container = document.getElementById('barber-list');
  if (!container) return;

  let html = `
    <div class="barber-card" data-id="any" onclick="selectBarber('any')">
      <div class="barber-avatar-placeholder"><i class="fa-solid fa-shuffle"></i></div>
      <div class="barber-info">
        <h3>Barber Mana Saja</h3>
        <p>Kami pilihkan yang tersedia</p>
      </div>
    </div>
  `;

  html += state.barbers.map(b => {
    const initials = b.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `
      <div class="barber-card" data-id="${b.id}" onclick="selectBarber('${b.id}')">
        <div class="barber-avatar-placeholder">${initials}</div>
        <div class="barber-info">
          <h3>${esc(b.name)}</h3>
          <p>${esc(b.speciality || 'Barber')}</p>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function renderDatePicker() {
  const container = document.getElementById('date-picker');
  if (!container) return;

  const today = new Date();
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    html += `
      <div class="date-item ${i === 0 ? 'today' : ''}" data-date="${dateStr}" onclick="selectDate('${dateStr}')">
        <span class="day-name">${DAYS_SHORT[d.getDay()]}</span>
        <span class="day-number">${d.getDate()}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function selectService(id) {
  state.selectedService = state.services.find(s => s.id === id);
  document.querySelectorAll('#service-list .service-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });
  updateNavButtons();
}

function selectBarber(id) {
  if (id === 'any' && state.barbers.length > 0) {
    state.selectedBarber = state.barbers[Math.floor(Math.random() * state.barbers.length)];
  } else {
    state.selectedBarber = state.barbers.find(b => b.id === id);
  }
  document.querySelectorAll('#barber-list .barber-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });
  updateNavButtons();
}

async function selectDate(dateStr) {
  state.selectedDate = dateStr;
  state.selectedTime = null;

  document.querySelectorAll('.date-item').forEach(c => {
    c.classList.toggle('selected', c.dataset.date === dateStr);
  });

  const slotsContainer = document.getElementById('time-slots');
  slotsContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1rem"><i class="fa-solid fa-spinner fa-spin" style="color:var(--gold)"></i></div>';

  try {
    const barberId = state.selectedBarber?.id;
    const duration = state.selectedService?.duration_minutes || 30;
    const res = await apiGet(`/api/booking/slots?date=${dateStr}&barber_id=${barberId}&duration=${duration}`);

    if (res.data && res.data.length > 0) {
      slotsContainer.innerHTML = res.data.map(s => `
        <div class="time-slot ${s.available ? 'available' : 'unavailable'}"
             data-time="${s.time}"
             ${s.available ? `onclick="selectTime('${s.time}')"` : ''}>
          ${s.time}
        </div>
      `).join('');
    } else {
      slotsContainer.innerHTML = '<p class="text-muted" style="grid-column:1/-1;text-align:center;padding:1rem">Tidak ada slot tersedia di hari ini</p>';
    }
  } catch {
    slotsContainer.innerHTML = '<p class="text-muted" style="grid-column:1/-1;text-align:center">Gagal memuat jadwal</p>';
  }

  updateNavButtons();
}

function selectTime(time) {
  state.selectedTime = time;
  document.querySelectorAll('.time-slot').forEach(s => {
    s.classList.toggle('selected', s.dataset.time === time);
  });
  updateNavButtons();
}

function renderSummary() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('summary-service', state.selectedService?.name || '-');
  set('summary-barber', state.selectedBarber?.name || '-');
  set('summary-date', state.selectedDate ? formatDate(state.selectedDate) : '-');
  set('summary-time', state.selectedTime || '-');
  set('summary-duration', (state.selectedService?.duration_minutes || '-') + ' menit');
  set('summary-price', formatRupiah(state.selectedService?.price || 0));
}

function goToStep(step) {
  if (step < 1) return;

  if (step > state.step) {
    if (state.step === 1 && !state.selectedService) { showToast('Pilih layanan terlebih dahulu', 'error'); return; }
    if (state.step === 2 && !state.selectedBarber) { showToast('Pilih barber terlebih dahulu', 'error'); return; }
    if (state.step === 3 && (!state.selectedDate || !state.selectedTime)) { showToast('Pilih tanggal dan waktu', 'error'); return; }
  }

  state.step = step;

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

  if (step === 4) renderSummary();

  const nav = document.getElementById('wizard-nav');
  if (nav) nav.style.display = step === 5 ? 'none' : '';

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
  else if (state.step === 2) btnNext.disabled = !state.selectedBarber;
  else if (state.step === 3) btnNext.disabled = !state.selectedTime;
}

async function confirmBooking() {
  const name = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const email = document.getElementById('customer-email').value.trim();
  const notes = document.getElementById('customer-notes').value.trim();

  if (!name || !phone) { showToast('Nama dan No. HP wajib diisi', 'error'); return; }

  const btn = document.getElementById('btn-confirm');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

  try {
    const res = await apiPost('/api/booking/create', {
      customer_name: name,
      customer_phone: phone,
      customer_email: email || null,
      service_id: state.selectedService.id,
      barber_id: state.selectedBarber.id,
      booking_date: state.selectedDate,
      booking_time: state.selectedTime,
      notes: notes || null
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
}

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

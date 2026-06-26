let cart = [];
let payMethod = 'cash';
let selectedBarber = null;
let services = [];
let products = [];
let barbers = [];
let transactions = [];
let currentDate = '';

function fmt(n) { return 'Rp ' + (n||0).toLocaleString('id-ID'); }
function esc(str) { const d = document.createElement('div'); d.textContent = str ?? ''; return d.innerHTML; }

// ============================================
// AUTH
// ============================================
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) throw new Error();
    return data.data;
  } catch { window.location.href = '/login'; }
}

// ============================================
// LOAD DATA
// ============================================
async function loadServices() {
  try {
    const res = await fetch('/api/booking/services', { credentials: 'include' });
    const data = await res.json();
    services = (data.data || []).map(s => ({
      id: s.id, name: s.name, price: s.price, category: s.category || 'potong',
      duration: s.duration_minutes, type: 'service'
    }));
  } catch {}
}

async function loadProducts() {
  try {
    const res = await fetch('/api/pos/products', { credentials: 'include' });
    const data = await res.json();
    products = (data.data || []).filter(p => p.is_active !== false);
  } catch {}
}

async function loadBarbers() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch('/api/booking/barbers?date=' + today, { credentials: 'include' });
    const data = await res.json();
    barbers = data.data || [];
  } catch {}
}

// ============================================
// RENDER
// ============================================
function renderBarbers() {
  const list = document.getElementById('barber-list');
  list.innerHTML = barbers.map(b =>
    '<button class="barber-chip" data-id="' + b.id + '" data-name="' + esc(b.name) + '">' +
    '<div class="barber-avatar">' + esc(b.name.charAt(0).toUpperCase()) + '</div>' +
    '<div class="barber-cname">' + esc(b.name) + '</div></button>'
  ).join('');

  list.querySelectorAll('.barber-chip').forEach(function(btn) {
    btn.addEventListener('click', function() { pickBarber(btn); });
  });
}

function getCategoryIcon(cat) {
  const icons = {
    potong: '<i class="fa-solid fa-scissors" style="color:#555"></i>',
    warna: '<i class="fa-solid fa-palette" style="color:#dc2626"></i>',
    perawatan: '<i class="fa-solid fa-spa" style="color:#16a34a"></i>',
    styling: '<i class="fa-solid fa-wand-magic-sparkles" style="color:#7c3aed"></i>'
  };
  return icons[cat] || '<i class="fa-solid fa-scissors" style="color:#555"></i>';
}

function renderGrid() {
  const grid = document.getElementById('pos-grid');
  let html = '';

  services.forEach(s => {
    html += '<div class="pos-item" data-cat="' + esc(s.category) + '" data-name="' + esc(s.name) + '" data-price="' + s.price + '" data-type="service" data-sid="' + s.id + '">' +
      '<span class="pos-item-icon">' + getCategoryIcon(s.category) + '</span>' +
      '<div class="pos-item-name">' + esc(s.name) + '</div>' +
      '<div class="pos-item-price">' + fmt(s.price) + '</div></div>';
  });

  products.forEach(p => {
    const disabled = p.stock <= 0 ? ' disabled' : '';
    const stockClass = p.stock <= 0 ? ' out' : p.stock <= 3 ? ' low' : '';
    const stockLabel = p.stock <= 0 ? 'Habis' : 'Stok: ' + p.stock;
    html += '<div class="pos-item' + disabled + '" data-cat="minuman" data-name="' + esc(p.name) + '" data-price="' + p.price + '" data-type="product" data-pid="' + p.id + '" data-stock="' + p.stock + '">' +
      '<span class="pos-item-icon">' + (p.icon || '🥤') + '</span>' +
      '<div class="pos-item-name">' + esc(p.name) + '</div>' +
      '<div class="pos-item-price">' + fmt(p.price) + '</div>' +
      '<div class="pos-item-stock' + stockClass + '">' + stockLabel + '</div></div>';
  });

  grid.innerHTML = html;

  grid.querySelectorAll('.pos-item:not(.disabled)').forEach(function(el) {
    el.addEventListener('click', function() { addToCart(el); });
  });

  renderCategories();
}

function renderCategories() {
  const cats = new Set(['all']);
  services.forEach(s => cats.add(s.category));
  if (products.length) cats.add('minuman');

  const catNames = { all: 'Semua', potong: 'Potong', warna: 'Warna', perawatan: 'Perawatan', styling: 'Styling', minuman: 'Minuman' };
  const container = document.getElementById('cat-tabs');
  container.innerHTML = [...cats].map(c =>
    '<button class="pos-cat' + (c === 'all' ? ' active' : '') + '" data-cat="' + c + '">' + (catNames[c] || c) + '</button>'
  ).join('');

  container.querySelectorAll('.pos-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.pos-cat').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterItems();
    });
  });
}

function filterItems() {
  const cat = document.querySelector('.pos-cat.active')?.dataset.cat || 'all';
  const q = document.getElementById('search-input').value.toLowerCase();
  document.querySelectorAll('.pos-item').forEach(el => {
    const matchCat = cat === 'all' || el.dataset.cat === cat;
    const matchSearch = !q || el.dataset.name.toLowerCase().includes(q);
    el.style.display = matchCat && matchSearch ? '' : 'none';
  });
}

// ============================================
// BARBER
// ============================================
function pickBarber(el) {
  var newId = el.dataset.id;
  if (selectedBarber && selectedBarber.id === newId) return;

  if (cart.length > 0) {
    cart = [];
    updateCartUI();
  }

  document.querySelectorAll('.barber-chip').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedBarber = { id: newId, name: el.dataset.name };
  document.getElementById('pos-locked').style.display = 'none';
  const main = document.getElementById('pos-main');
  main.classList.remove('pos-main-hidden');
  main.classList.add('pos-main-show');
  document.getElementById('cart-barber-tag').textContent = selectedBarber.name;
  document.getElementById('cart-barber-tag').style.display = '';
}

// ============================================
// CART
// ============================================
function addToCart(el) {
  const name = el.dataset.name;
  const price = parseInt(el.dataset.price);
  const type = el.dataset.type;
  const existing = cart.find(c => c.name === name);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      name, price, qty: 1, type,
      service_id: el.dataset.sid || null,
      product_id: el.dataset.pid || null
    });
  }
  updateCartUI();
}

function changeQty(idx, delta) {
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  updateCartUI();
}

function getTotal() { return cart.reduce((s, c) => s + c.price * c.qty, 0); }

function updateCartUI() {
  const qty = cart.reduce((s, c) => s + c.qty, 0);
  const total = getTotal();
  document.getElementById('cart-empty').style.display = qty ? 'none' : '';
  document.getElementById('cart-list').style.display = qty ? '' : 'none';
  document.getElementById('cart-footer').style.display = qty ? '' : 'none';
  document.getElementById('cart-total-val').textContent = fmt(total);

  document.querySelectorAll('.pos-item').forEach(el => {
    const c = cart.find(c => c.name === el.dataset.name);
    const old = el.querySelector('.pos-item-badge');
    if (old) old.remove();
    el.classList.toggle('in-cart', !!c);
    if (c) {
      const b = document.createElement('span');
      b.className = 'pos-item-badge'; b.textContent = c.qty; el.appendChild(b);
    }
  });

  var cartListEl = document.getElementById('cart-list');
  cartListEl.innerHTML = cart.map((c, i) =>
    '<div class="cart-row"><div class="cart-row-info"><div class="cart-row-name">' + esc(c.name) + '</div>' +
    '<div class="cart-row-price">' + fmt(c.price) + '</div></div>' +
    '<div class="cart-qty-ctrl"><button class="cart-qty-btn minus" data-idx="' + i + '" data-delta="-1">' +
    (c.qty === 1 ? '<i class="fa-solid fa-trash-can" style="font-size:0.65rem"></i>' : '−') +
    '</button><span class="cart-qty-val">' + c.qty + '</span>' +
    '<button class="cart-qty-btn" data-idx="' + i + '" data-delta="1">+</button></div>' +
    '<div class="cart-row-total">' + fmt(c.price * c.qty) + '</div></div>'
  ).join('');

  cartListEl.querySelectorAll('.cart-qty-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      changeQty(parseInt(btn.dataset.idx), parseInt(btn.dataset.delta));
    });
  });
}

// ============================================
// PAYMENT
// ============================================
function openPay() {
  if (!selectedBarber) return;
  if (!cart.length) return;
  document.getElementById('pay-total').textContent = fmt(getTotal());
  document.getElementById('cash-input').value = '';
  document.getElementById('change-val').textContent = 'Rp 0';
  payMethod = 'cash';
  document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('active'));
  document.querySelector('.pay-method.m-cash').classList.add('active');
  document.getElementById('cash-box').classList.add('show');
  document.getElementById('pay-overlay').classList.add('show');
}

function pickMethod(el, method) {
  payMethod = method;
  document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('cash-box').classList.toggle('show', method === 'cash');
}

function quickCash(val) {
  const amount = val === 'pas' ? getTotal() : val;
  document.getElementById('cash-input').value = amount.toLocaleString('id-ID');
  calcChange();
}

function calcChange() {
  const paid = parseInt(document.getElementById('cash-input').value.replace(/\D/g, '')) || 0;
  document.getElementById('change-val').textContent = fmt(Math.max(0, paid - getTotal()));
}

async function confirmPay() {
  const total = getTotal();
  const cashRaw = document.getElementById('cash-input').value.replace(/\D/g, '');
  const amountPaid = payMethod === 'cash' ? (parseInt(cashRaw) || total) : total;

  if (payMethod === 'cash' && amountPaid < total) {
    alert('Uang yang diterima kurang dari total.');
    return;
  }

  const btn = document.querySelector('.btn-confirm');
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    const res = await fetch('/api/pos/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        barber_id: selectedBarber.id,
        barber_name: selectedBarber.name,
        items: cart.map(c => ({ name: c.name, price: c.price, qty: c.qty, type: c.type, service_id: c.service_id, product_id: c.product_id })),
        payment_method: payMethod,
        amount_paid: amountPaid
      })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('pay-overlay').classList.remove('show');
      showReceipt(data.data);
    } else {
      alert(data.message || 'Gagal menyimpan transaksi.');
    }
  } catch {
    alert('Terjadi kesalahan.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Konfirmasi Pembayaran';
  }
}

// ============================================
// RECEIPT
// ============================================
function showReceipt(trx) {
  const change = trx.change_amount || 0;
  const methods = { cash: 'Cash', transfer: 'Transfer', qris: 'QRIS' };
  const d = new Date(trx.created_at);
  const ds = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getFullYear()).slice(-2);
  const ts = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');

  document.getElementById('receipt-meta').innerHTML =
    '<div class="receipt-line"><span class="l">Stylist</span><span>' + esc(trx.barber_name) + '</span></div>';

  document.getElementById('receipt-items').innerHTML = (trx.items || []).map(c =>
    '<div class="receipt-line bold"><span>' + esc(c.name) + (c.qty > 1 ? ' x' + c.qty : '') + '</span><span>' + fmt(c.price * c.qty) + '</span></div>'
  ).join('');

  document.getElementById('receipt-total').innerHTML = '<span>TOTAL</span><span>' + fmt(trx.total) + '</span>';

  let pi = '<div class="receipt-line"><span class="l">Metode</span><span>' + methods[trx.payment_method] + '</span></div>';
  if (trx.payment_method === 'cash') {
    pi += '<div class="receipt-line"><span class="l">Bayar</span><span>' + fmt(trx.amount_paid) + '</span></div>';
    pi += '<div class="receipt-line bold"><span class="l">Kembalian</span><span style="color:#16a34a">' + fmt(change) + '</span></div>';
  }
  document.getElementById('receipt-pay-info').innerHTML = pi;
  document.getElementById('receipt-trx').textContent = ds + ' ' + ts + ' • #' + trx.id.slice(0, 8).toUpperCase();
  document.getElementById('receipt-wa-phone').value = '';
  document.getElementById('receipt-overlay').classList.add('show');

  // Store for WA
  window._lastReceipt = trx;
}

function closeReceipt() {
  document.getElementById('receipt-overlay').classList.remove('show');
  cart = [];
  updateCartUI();
  loadProducts();
}

function sendWA() {
  const phone = document.getElementById('receipt-wa-phone').value.replace(/\D/g, '');
  if (!phone || phone.length < 10) {
    document.getElementById('receipt-wa-phone').style.borderColor = '#dc2626';
    return;
  }
  const waNum = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
  const trx = window._lastReceipt;
  if (!trx) return;

  const items = (trx.items || []).map(c => c.name + (c.qty > 1 ? ' x' + c.qty : '') + ' — ' + fmt(c.price * c.qty)).join('\n');
  const methods = { cash: 'Cash', transfer: 'Transfer', qris: 'QRIS' };
  let payLine = 'Metode: ' + methods[trx.payment_method];
  if (trx.payment_method === 'cash') {
    payLine += '\nBayar: ' + fmt(trx.amount_paid) + '\nKembalian: ' + fmt(trx.change_amount || 0);
  }

  const text = encodeURIComponent(
    '*LUMEN\'S STUDIO*\n━━━━━━━━━━━━━━\nStylist: ' + trx.barber_name +
    '\n━━━━━━━━━━━━━━\n' + items +
    '\n━━━━━━━━━━━━━━\n*TOTAL: ' + fmt(trx.total) + '*\n' + payLine +
    '\n━━━━━━━━━━━━━━\nTerima kasih!'
  );
  window.open('https://wa.me/' + waNum + '?text=' + text, '_blank');
}

// ============================================
// RIWAYAT + OMSET
// ============================================
function showPage(page) {
  document.getElementById('pos-page').style.display = page === 'pos' ? 'flex' : 'none';
  document.getElementById('riwayat-page').classList.toggle('show', page === 'riwayat');
  document.getElementById('nav-pos').classList.toggle('active', page === 'pos');
  document.getElementById('nav-riwayat').classList.toggle('active', page === 'riwayat');
  if (page === 'riwayat') loadRiwayat();
}

async function loadRiwayat() {
  const date = document.getElementById('riwayat-date').value || currentDate;
  try {
    const [trxRes, sumRes] = await Promise.all([
      fetch('/api/pos/transactions?date=' + date, { credentials: 'include' }),
      fetch('/api/pos/summary?date=' + date, { credentials: 'include' })
    ]);
    const trxData = await trxRes.json();
    const sumData = await sumRes.json();
    transactions = trxData.data || [];
    if (sumData.success) renderSummary(sumData.data);
    renderRiwayat();
  } catch {}
}

function renderSummary(s) {
  document.getElementById('omset-total').textContent = fmt(s.omset);
  document.getElementById('omset-count').textContent = s.totalTransactions + ' transaksi';
  document.getElementById('omset-cash').textContent = fmt(s.cash.total);
  document.getElementById('omset-cash-count').textContent = s.cash.count + ' trx';
  document.getElementById('omset-transfer').textContent = fmt(s.transfer.total);
  document.getElementById('omset-transfer-count').textContent = s.transfer.count + ' trx';
  document.getElementById('omset-qris').textContent = fmt(s.qris.total);
  document.getElementById('omset-qris-count').textContent = s.qris.count + ' trx';
  document.getElementById('omset-refund').textContent = '-' + fmt(s.refund.total);
  document.getElementById('omset-refund-count').textContent = s.refund.count + ' trx';
}

function renderRiwayat() {
  const list = document.getElementById('riwayat-list');
  const q = (document.getElementById('riwayat-search')?.value || '').toLowerCase();

  const filtered = q ? transactions.filter(t =>
    t.id.toLowerCase().includes(q) || (t.barber_name || '').toLowerCase().includes(q) ||
    (t.customer_name || '').toLowerCase().includes(q)
  ) : transactions;

  if (!filtered.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:#ccc"><i class="fa-solid fa-inbox" style="font-size:2rem;margin-bottom:10px;display:block"></i><p>Tidak ada transaksi</p></div>';
    return;
  }

  const methods = { cash: '<i class="fa-solid fa-money-bill-wave" style="color:#16a34a"></i> Cash', transfer: '<i class="fa-solid fa-building-columns" style="color:#2563eb"></i> Transfer', qris: '<i class="fa-solid fa-qrcode" style="color:#7c3aed"></i> QRIS' };

  list.innerHTML = filtered.map(t => {
    const d = new Date(t.created_at);
    const time = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    const isRefunded = t.status === 'refunded';
    const items = (t.items || []).map(i => i.name).join(', ');
    const shortId = '#' + t.id.slice(0, 8).toUpperCase();

    return '<div class="trx-card' + (isRefunded ? ' refunded' : '') + '">' +
      '<div class="trx-top"><div><span class="trx-id">' + shortId + '</span> <span class="trx-time">' + time + '</span></div>' +
      '<span class="trx-badge ' + (isRefunded ? 'refunded' : 'paid') + '">' +
      (isRefunded ? '<i class="fa-solid fa-rotate-left"></i> Refund' : '<i class="fa-solid fa-check"></i> Lunas') + '</span></div>' +
      '<div class="trx-mid"><div class="trx-info"><div class="trx-stylist"><i class="fa-solid fa-user-tie"></i> ' + esc(t.barber_name) + '</div>' +
      '<div class="trx-items">' + esc(items) + '</div></div>' +
      '<div class="trx-total' + (isRefunded ? ' line-through' : '') + '">' + fmt(t.total) + '</div></div>' +
      '<div class="trx-bottom"><div class="trx-method">' + (methods[t.payment_method] || t.payment_method) +
      (isRefunded ? ' &bull; <span style="color:#dc2626">' + esc(t.refund_reason || '') + '</span>' : '') + '</div>' +
      '<div class="trx-actions">' +
      (!isRefunded ? '<button class="trx-btn refund-btn" onclick="openRefund(\'' + t.id + '\')"><i class="fa-solid fa-rotate-left"></i> Refund</button>' : '') +
      '</div></div></div>';
  }).join('');
}

// ============================================
// REFUND
// ============================================
let refundTarget = null;

function openRefund(id) {
  const trx = transactions.find(t => t.id === id);
  if (!trx) return;
  refundTarget = trx;
  document.getElementById('refund-trx-id').textContent = '#' + id.slice(0, 8).toUpperCase();
  document.getElementById('refund-items').textContent = (trx.items || []).map(i => i.name).join(', ');
  document.getElementById('refund-total').textContent = fmt(trx.total);
  document.getElementById('refund-reason').value = '';
  document.getElementById('refund-overlay').classList.add('show');
}

async function confirmRefund() {
  if (!refundTarget) return;
  const reason = document.getElementById('refund-reason').value;
  if (!reason) { document.getElementById('refund-reason').style.borderColor = '#dc2626'; return; }

  const btn = document.querySelector('.btn-refund-confirm');
  btn.disabled = true; btn.textContent = 'Memproses...';

  try {
    const res = await fetch('/api/pos/transactions/' + refundTarget.id + '/refund', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('refund-overlay').classList.remove('show');
      loadRiwayat();
    } else {
      alert(data.message || 'Gagal refund.');
    }
  } catch {
    alert('Terjadi kesalahan.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Proses Refund';
  }
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();

  const now = new Date();
  currentDate = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  document.getElementById('pos-date').textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('riwayat-date').value = currentDate;

  await Promise.all([loadServices(), loadProducts(), loadBarbers()]);
  renderBarbers();
  renderGrid();

  document.getElementById('nav-pos').addEventListener('click', function() { showPage('pos'); });
  document.getElementById('nav-riwayat').addEventListener('click', function() { showPage('riwayat'); });
  document.getElementById('btn-bayar').addEventListener('click', openPay);
  document.getElementById('btn-confirm-pay').addEventListener('click', confirmPay);
  document.getElementById('btn-send-wa').addEventListener('click', sendWA);
  document.getElementById('btn-close-receipt').addEventListener('click', closeReceipt);
  document.getElementById('btn-confirm-refund').addEventListener('click', confirmRefund);

  document.querySelectorAll('.pay-method').forEach(function(btn) {
    btn.addEventListener('click', function() { pickMethod(btn, btn.dataset.method); });
  });
  document.querySelectorAll('.cash-quick button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var val = btn.dataset.cash;
      quickCash(val === 'pas' ? 'pas' : parseInt(val));
    });
  });

  document.getElementById('cash-input').addEventListener('input', calcChange);
  document.getElementById('search-input').addEventListener('input', filterItems);
  document.getElementById('riwayat-date').addEventListener('change', loadRiwayat);
  document.getElementById('riwayat-search')?.addEventListener('input', renderRiwayat);

  ['pay-overlay', 'receipt-overlay', 'refund-overlay'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target.id === id) {
        if (id === 'receipt-overlay') closeReceipt();
        else e.target.classList.remove('show');
      }
    });
  });
});

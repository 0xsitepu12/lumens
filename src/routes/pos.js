const express = require('express');
const db = require('../db');
const { requireKasir, requireAdmin } = require('../middleware/auth');
const { todayWIB } = require('../config');

const router = express.Router();

// ============================================
// PRODUCTS (minuman dll)
// ============================================
router.get('/products', requireKasir, async (req, res) => {
  try {
    const { data } = await db.supabase.from('products')
      .select('*')
      .order('category')
      .order('name');
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[pos/products]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/products', requireAdmin, async (req, res) => {
  try {
    const { name, price, modal_price, category, stock, icon } = req.body;
    if (!name || !price) return res.json({ success: false, message: 'Nama dan harga wajib' });
    const { data, error } = await db.supabase.from('products')
      .insert({ name, price, modal_price: modal_price || 0, category: category || 'minuman', stock: stock || 0, icon: icon || '🥤', is_active: true })
      .select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('[pos/products/create]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/products/:id', requireAdmin, async (req, res) => {
  try {
    const { name, price, modal_price, category, stock, icon, is_active } = req.body;
    const { data, error } = await db.supabase.from('products')
      .update({ name, price, modal_price, category, stock, icon, is_active })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('[pos/products/update]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await db.supabase.from('products')
      .delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Produk dihapus' });
  } catch (err) {
    console.error('[pos/products/delete]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// TRANSACTIONS
// ============================================
router.post('/transactions', requireKasir, async (req, res) => {
  try {
    const { barber_id, barber_name, customer_name, items, payment_method, amount_paid } = req.body;
    if (!barber_id || !items?.length || !payment_method)
      return res.json({ success: false, message: 'Data tidak lengkap' });

    // Server-side price lookup — never trust client-sent prices
    const verifiedItems = [];
    for (const item of items) {
      if (item.service_id) {
        const service = await db.getServiceById(item.service_id);
        if (!service) return res.json({ success: false, message: `Layanan tidak ditemukan: ${item.service_id}` });
        verifiedItems.push({ ...item, price: service.price });
      } else if (item.product_id) {
        const { data: product, error } = await db.supabase.from('products').select('*').eq('id', item.product_id).single();
        if (error || !product) return res.json({ success: false, message: `Produk tidak ditemukan: ${item.product_id}` });
        verifiedItems.push({ ...item, price: product.price });
      } else {
        return res.json({ success: false, message: 'Item harus memiliki service_id atau product_id' });
      }
    }

    const total = verifiedItems.reduce((s, i) => s + i.price * i.qty, 0);
    const change = payment_method === 'cash' ? Math.max(0, (amount_paid || total) - total) : 0;

    const { data: trx, error } = await db.supabase.from('pos_transactions')
      .insert({
        barber_id,
        barber_name: barber_name || '',
        customer_name: customer_name || 'Tamu',
        items: verifiedItems,
        total,
        payment_method,
        amount_paid: amount_paid || total,
        change_amount: change,
        status: 'paid',
        cashier: req.user.username,
        transaction_date: todayWIB()
      })
      .select().single();
    if (error) throw error;

    // Kurangi stok produk
    for (const item of verifiedItems) {
      if (item.product_id) {
        await db.supabase.rpc('decrement_stock', { p_id: item.product_id, qty: item.qty });
      }
    }

    db.logActivity({ action: 'pos_sale', category: 'pos', actor: req.user.username, detail: `${trx.id.slice(0,8)} — ${total}`, ip: req.ip });
    res.json({ success: true, data: trx });
  } catch (err) {
    console.error('[pos/transactions]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/transactions', requireKasir, async (req, res) => {
  try {
    const date = req.query.date || todayWIB();
    const { data } = await db.supabase.from('pos_transactions')
      .select('*')
      .eq('transaction_date', date)
      .order('created_at', { ascending: false });
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[pos/transactions/list]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/summary', requireKasir, async (req, res) => {
  try {
    const date = req.query.date || todayWIB();
    const { data } = await db.supabase.from('pos_transactions')
      .select('*')
      .eq('transaction_date', date);
    const trx = data || [];

    const paid = trx.filter(t => t.status === 'paid');
    const refunded = trx.filter(t => t.status === 'refunded');

    const totalOmset = paid.reduce((s, t) => s + t.total, 0);
    const cashTotal = paid.filter(t => t.payment_method === 'cash').reduce((s, t) => s + t.total, 0);
    const transferTotal = paid.filter(t => t.payment_method === 'transfer').reduce((s, t) => s + t.total, 0);
    const qrisTotal = paid.filter(t => t.payment_method === 'qris').reduce((s, t) => s + t.total, 0);
    const refundTotal = refunded.reduce((s, t) => s + t.total, 0);

    res.json({
      success: true,
      data: {
        omset: totalOmset,
        cash: { total: cashTotal, count: paid.filter(t => t.payment_method === 'cash').length },
        transfer: { total: transferTotal, count: paid.filter(t => t.payment_method === 'transfer').length },
        qris: { total: qrisTotal, count: paid.filter(t => t.payment_method === 'qris').length },
        refund: { total: refundTotal, count: refunded.length },
        totalTransactions: paid.length
      }
    });
  } catch (err) {
    console.error('[pos/summary]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// REFUND (admin only)
// ============================================
router.put('/transactions/:id/refund', requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.json({ success: false, message: 'Alasan refund wajib diisi' });

    const { data: trx } = await db.supabase.from('pos_transactions')
      .select('*').eq('id', req.params.id).single();
    if (!trx) return res.json({ success: false, message: 'Transaksi tidak ditemukan' });
    if (trx.status === 'refunded') return res.json({ success: false, message: 'Sudah di-refund' });

    const { data, error } = await db.supabase.from('pos_transactions')
      .update({ status: 'refunded', refund_reason: reason, refunded_at: new Date().toISOString(), refunded_by: req.user.username })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;

    // Kembalikan stok produk
    if (trx.items) {
      for (const item of trx.items) {
        if (item.product_id) {
          await db.supabase.rpc('increment_stock', { p_id: item.product_id, qty: item.qty });
        }
      }
    }

    db.logActivity({ action: 'pos_refund', category: 'pos', actor: req.user.username, detail: `${req.params.id.slice(0,8)} — ${reason}`, ip: req.ip });
    res.json({ success: true, data });
  } catch (err) {
    console.error('[pos/refund]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

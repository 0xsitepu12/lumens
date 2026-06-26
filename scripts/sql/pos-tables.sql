-- ============================================
-- POS TABLES - Run this in Supabase SQL Editor
-- ============================================

-- Products (minuman, dll)
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'minuman',
  stock INTEGER DEFAULT 0,
  modal_price INTEGER DEFAULT 0,
  icon TEXT DEFAULT '🥤',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- POS Transactions
CREATE TABLE IF NOT EXISTS pos_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id UUID REFERENCES barbers(id),
  barber_name TEXT,
  customer_name TEXT DEFAULT 'Tamu',
  items JSONB NOT NULL DEFAULT '[]',
  total INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'qris')),
  amount_paid INTEGER DEFAULT 0,
  change_amount INTEGER DEFAULT 0,
  status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'refunded')),
  cashier TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  refund_reason TEXT,
  refunded_at TIMESTAMPTZ,
  refunded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast date queries
CREATE INDEX IF NOT EXISTS idx_pos_transactions_date ON pos_transactions(transaction_date);

-- Function to decrement product stock
CREATE OR REPLACE FUNCTION decrement_stock(p_id UUID, qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products SET stock = GREATEST(0, stock - qty) WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment product stock (for refund)
CREATE OR REPLACE FUNCTION increment_stock(p_id UUID, qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products SET stock = stock + qty WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (skip if already exists)
DO $$ BEGIN
  CREATE POLICY "service_role_all" ON products FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all" ON pos_transactions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

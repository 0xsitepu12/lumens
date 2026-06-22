require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

if (!globalThis.WebSocket) globalThis.WebSocket = require('ws');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setup() {
  // Create activity_logs table via raw SQL
  const { error: tableErr } = await supabase.rpc('exec_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        action VARCHAR(50) NOT NULL,
        category VARCHAR(20) NOT NULL,
        actor VARCHAR(100),
        detail TEXT,
        ip VARCHAR(45),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_logs_category ON activity_logs(category);
    `
  });

  if (tableErr) {
    console.log('RPC not available, trying direct insert test...');
    // Table might already exist or need manual creation
    // Try inserting a test log
    const { error: insertErr } = await supabase.from('activity_logs').insert({
      action: 'system_setup',
      category: 'system',
      actor: 'setup_script',
      detail: 'Activity logs table verified'
    });

    if (insertErr) {
      console.log('\nTable does not exist. Create it manually in Supabase SQL Editor:\n');
      console.log(`CREATE TABLE activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  category VARCHAR(20) NOT NULL,
  actor VARCHAR(100),
  detail TEXT,
  ip VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_logs_created ON activity_logs(created_at DESC);
CREATE INDEX idx_logs_category ON activity_logs(category);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON activity_logs
  FOR ALL USING (true) WITH CHECK (true);
`);
      console.log('\nAlso update admin user role to superadmin:\n');
      console.log(`UPDATE users SET role = 'superadmin' WHERE username = 'admin';`);
      return;
    }
    console.log('Table exists! Test log inserted.');
  } else {
    console.log('Table created successfully!');
  }

  // Update admin to superadmin
  const { error: roleErr } = await supabase
    .from('users')
    .update({ role: 'superadmin' })
    .eq('username', 'admin');

  if (roleErr) {
    console.log('Role update error:', roleErr.message);
  } else {
    console.log('Admin upgraded to superadmin!');
  }
}

setup();

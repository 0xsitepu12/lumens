const db = require('./db');
const nodemailer = require('nodemailer');

const TABLES = [
  { name: 'bookings',          query: () => db.supabase.from('bookings').select('*').order('created_at', { ascending: false }) },
  { name: 'pos_transactions',  query: () => db.supabase.from('pos_transactions').select('*').order('created_at', { ascending: false }) },
  { name: 'services',          query: () => db.supabase.from('services').select('*') },
  { name: 'products',          query: () => db.supabase.from('products').select('*') },
  { name: 'barbers',           query: () => db.supabase.from('barbers').select('*') },
  { name: 'barber_schedules',  query: () => db.supabase.from('barber_schedules').select('*') },
  { name: 'users',             query: () => db.supabase.from('users').select('id, username, role, full_name, email, is_active, created_at') },
];

async function generateBackup() {
  const payload = { generated_at: new Date().toISOString(), version: '1.0', tables: {} };

  for (const t of TABLES) {
    const { data, error } = await t.query();
    if (error) console.error('[backup] error fetching', t.name, error.message);
    payload.tables[t.name] = data || [];
  }

  const json = JSON.stringify(payload, null, 2);
  const totalRows = Object.values(payload.tables).reduce((s, rows) => s + rows.length, 0);
  return { json, totalRows, generatedAt: payload.generated_at };
}

async function sendBackupEmail() {
  if (!process.env.SMTP_PASS) {
    throw new Error('SMTP_PASS belum dikonfigurasi');
  }

  const { json, totalRows, generatedAt } = await generateBackup();

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  const date = new Date(generatedAt).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const filename = `lumens-backup-${generatedAt.slice(0, 10)}.json`;
  const recipient = process.env.BACKUP_EMAIL || process.env.SMTP_USER;

  const counts = {};
  const parsed = JSON.parse(json);
  for (const [k, v] of Object.entries(parsed.tables)) counts[k] = v.length;

  await transporter.sendMail({
    from: `"LUMEN'S Backup" <${process.env.SMTP_USER}>`,
    to: recipient,
    subject: `[BACKUP] LUMEN'S STUDIO — ${date}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px">
        <h2 style="color:#1a1a1a">🗄️ Backup Database LUMEN'S STUDIO</h2>
        <p style="color:#555">Backup otomatis mingguan — ${date}</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          ${Object.entries(counts).map(([k, v]) =>
            `<tr><td style="padding:6px 12px;border:1px solid #eee;color:#555">${k}</td>
             <td style="padding:6px 12px;border:1px solid #eee;font-weight:600">${v.toLocaleString('id-ID')} baris</td></tr>`
          ).join('')}
          <tr style="background:#f5f5f5"><td style="padding:8px 12px;border:1px solid #eee;font-weight:700">TOTAL</td>
            <td style="padding:8px 12px;border:1px solid #eee;font-weight:700">${totalRows.toLocaleString('id-ID')} baris</td></tr>
        </table>
        <p style="color:#888;font-size:0.85rem">File backup terlampir. Simpan ke OneDrive atau lokasi aman.</p>
      </div>
    `,
    attachments: [{ filename, content: json, contentType: 'application/json' }]
  });

  console.log(`[backup] Sent to ${recipient} — ${totalRows} rows — ${filename}`);
  return { totalRows, filename, recipient };
}

module.exports = { generateBackup, sendBackupEmail };

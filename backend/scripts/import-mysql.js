// One-time import into EMPTY target collections. Stop API writes while importing.
require('dotenv').config();
const sql = require('./mysql-source.cjs');
const db = require('../src/db');
const tables = ['users', 'systems', 'change_requests', 'cr_change_types', 'cr_action_plans', 'cr_rollback_plans', 'cr_approvals'];
const timestamp = (value) => value ? new Date(String(value).replace(' ', 'T') + (String(value).endsWith('Z') ? '' : 'Z')).toISOString() : null;
async function main({ apply = false } = {}) {
  const data = {};
  const connection = await sql.getConnection();
  try {
    await connection.beginTransaction();
    for (const table of tables) {
      [data[table]] = await connection.query({ sql: `SELECT * FROM ${table}`, dateStrings: true });
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
  const count = Object.fromEntries(tables.map((table) => [table, data[table].length]));
  console.log('Source row counts:', count);
  if (!apply) {
    console.log('Dry run only. Stop API writes, then use --apply to import into an empty Firestore database.');
    return;
  }
  // A single batch is atomic; refuse oversized imports rather than leave partial data.
  const total = data.users.length + data.systems.length + data.change_requests.length + data.cr_approvals.length + 1;
  if (total > 450) throw new Error('Import exceeds 450 documents. Use a staged migration for larger datasets.');
  for (const collection of ['users', 'systems', 'change_requests', 'counters']) {
    if (!(await db.collection(collection).limit(1).get()).empty) throw new Error(`Target ${collection} is not empty; import refused.`);
  }
  const batch = db.batch();
  for (const [collection, key] of [['users', 'user_id'], ['systems', 'system_id']]) {
    for (const row of data[collection]) {
      const normalized = { ...row };
      for (const field of ['created_at', 'updated_at']) if (field in normalized) normalized[field] = timestamp(normalized[field]);
      batch.create(db.collection(collection).doc(String(row[key])), normalized);
    }
  }
  const plans = (table, id) => data[table].filter((p) => p.cr_id === id).sort((a, b) => a.seq_no - b.seq_no)
    .map(({ step, start_date, end_date, owner, note }) => ({ step, start_date, end_date, owner, note }));
  for (const cr of data.change_requests) {
    batch.create(db.collection('change_requests').doc(String(cr.cr_id)), { ...cr,
      created_at: timestamp(cr.created_at), updated_at: timestamp(cr.updated_at),
      changeTypes: data.cr_change_types.filter((t) => t.cr_id === cr.cr_id).map((t) => t.change_type),
      plan: plans('cr_action_plans', cr.cr_id), rollbackPlan: plans('cr_rollback_plans', cr.cr_id),
    });
  }
  for (const a of data.cr_approvals) {
    batch.create(db.doc(`change_requests/${a.cr_id}/approvals/${a.approval_id}`), { ...a, created_at: timestamp(a.created_at) });
  }
  batch.create(db.doc('counters/change_requests'), { lastId: Math.max(0, ...data.change_requests.map((cr) => cr.cr_id)) });
  await batch.commit();
  console.log(`Imported ${total} documents. Source MySQL data was not modified.`);
}
if (require.main === module) main({ apply: process.argv.includes('--apply') }).catch((error) => {
  console.error('Import failed:', error.message);
  process.exitCode = 1;
}).finally(async () => { await sql.end(); await db.terminate(); });

module.exports = { main };

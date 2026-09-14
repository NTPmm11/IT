const { test } = require('node:test');
const assert = require('node:assert/strict');
// Refuse to run destructive fixtures against a real project.
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore emulator is required');
process.env.FIREBASE_PROJECT_ID = 'demo-cr-migration';
const db = require('../src/db');
const bcrypt = require('bcryptjs');
// No real email is sent during verification.
const mailer = require('../src/services/mailer');
const notifications = [];
mailer.sendMail = async (message) => { notifications.push(message); };
const app = require('../src/index');

test('Firestore-backed API compatibility and atomic updates', async (t) => {
  await t.test('MySQL import preserves IDs/plans/hashes and refuses overwrites', async () => {
    const fixtures = {
      users: [{ user_id: 7, username: 'imported', password_hash: 'preserve-this-hash', is_active: 1 }],
      systems: [{ system_id: 8, system_code: 'IMPORT', system_name: 'Imported', is_active: 1 }],
      change_requests: [{ cr_id: 42, cr_number: 'CR0000042', requester_id: 7, system_id: 8,
        request_date: '2026-09-14', created_at: '2026-09-14 09:00:00', updated_at: '2026-09-14 10:00:00' }],
      cr_change_types: [{ cr_id: 42, change_type: 'DB' }],
      cr_action_plans: [{ cr_id: 42, seq_no: 1, step: 'Migrate', start_date: null, end_date: null, owner: null, note: null }],
      cr_rollback_plans: [],
      cr_approvals: [{ cr_id: 42, approval_id: 10, approver_id: 7, result: 'approved', created_at: '2026-09-14 10:00:00' }],
    };
    // Supply source fixtures; never connect to the user's actual MySQL database in tests.
    const sourcePath = require.resolve('../scripts/mysql-source.cjs');
    require.cache[sourcePath] = { id: sourcePath, filename: sourcePath, loaded: true, exports: {
      getConnection: async () => ({ beginTransaction: async () => {}, commit: async () => {},
        rollback: async () => {}, release: () => {},
        query: async ({ sql }) => [fixtures[sql.split(' ').at(-1)]],
      }),
    } };
    const { main: migrate } = require('../scripts/import-mysql');
    await migrate();
    assert.equal((await db.doc('users/7').get()).exists, false);
    await migrate({ apply: true });
    assert.equal((await db.doc('users/7').get()).data().password_hash, 'preserve-this-hash');
    const imported = (await db.doc('change_requests/42').get()).data();
    assert.equal(imported.request_date, '2026-09-14');
    assert.equal(imported.created_at, '2026-09-14T09:00:00.000Z');
    assert.equal(imported.plan[0].step, 'Migrate');
    assert.deepEqual(imported.changeTypes, ['DB']);
    assert.equal((await db.doc('change_requests/42/approvals/10').get()).data().result, 'approved');
    assert.equal((await db.doc('counters/change_requests').get()).data().lastId, 42);
    await assert.rejects(() => migrate({ apply: true }), /not empty/);
    for (const collection of ['users', 'systems', 'change_requests', 'counters']) await db.recursiveDelete(db.collection(collection));
  });
  const batch = db.batch();
  const password_hash = await bcrypt.hash('test-only-password', 4);
  for (const [id, role] of [[1, 'it_admin'], [2, 'requester'], [3, 'requester'], [4, 'approver']]) {
    batch.set(db.doc(`users/${id}`), { user_id: id, username: `user${id}`, full_name: `User ${id}`,
      role, password_hash, department: 'IT', email: `user${id}@example.invalid`, is_active: 1 });
  }
  batch.set(db.doc('users/5'), { user_id: 5, username: 'disabled', password_hash, is_active: 0 });
  batch.set(db.doc('systems/1'), { system_id: 1, system_code: 'APP', system_name: 'Application', is_active: 1 });
  batch.set(db.doc('systems/2'), { system_id: 2, system_code: 'OLD', system_name: 'Inactive', is_active: 0 });
  await batch.commit();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (path, user, body) => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(user ? { 'X-User-Id': String(user) } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.terminate();
  });
  const payload = { subject: 'Migration check', systemCode: 'APP', requestDate: '2026-09-14',
    plan: [{ step: 'Deploy', start: '09:00', end: '10:00', owner: 'IT' }],
    rollbackPlan: [{ step: 'Restore' }], priority: 'High', changeTypes: ['App'], impact: 'other', downtime: true };
  await t.test('login, disabled accounts, and API access', async () => {
    const login = await request('/auth/login', null, { username: 'user2', password: 'test-only-password' });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.userId, 2);
    assert.equal(login.body.user.password_hash, undefined);
    assert.equal((await request('/auth/login', null, { username: 'user2', password: 'wrong' })).status, 401);
    assert.equal((await request('/auth/login', null, { username: 'disabled', password: 'test-only-password' })).status, 401);
    assert.equal((await request('/systems')).status, 401);
    assert.equal((await request('/systems', 'bad')).status, 401);
    assert.equal((await request('/systems', 5)).status, 401);
    assert.deepEqual((await request('/systems', 2)).body, [{ system_code: 'APP', system_name: 'Application' }]);
  });
  await t.test('invalid payloads do not allocate IDs or write documents', async () => {
    for (const body of [{}, { ...payload, systemCode: 'MISSING' }, { ...payload, plan: [{}] }, { ...payload, changeTypes: 'App' }, { ...payload, priority: 'bad' }]) {
      assert.equal((await request('/change-requests', 2, body)).status, 400);
    }
    assert.equal((await db.doc('counters/change_requests').get()).exists, false);
  });
  let crId;
  await t.test('create/detail preserves plans and enforces owner visibility', async () => {
    assert.equal((await request('/change-requests/next-number', 2)).body.crNumber, 'CR0000001');
    const created = await request('/change-requests', 2, payload);
    assert.equal(created.status, 201);
    crId = created.body.crId;
    const detail = (await request(`/change-requests/${crId}`, 2)).body;
    assert.equal(detail.requester, 'User 2');
    assert.equal(detail.system_name, 'Application');
    assert.equal(detail.plan[0].start_date, '09:00');
    assert.equal(detail.rollbackPlan[0].step, 'Restore');
    assert.deepEqual(detail.changeTypes, []);
    assert.equal(detail.impact, 'none');
    assert.equal(detail.downtime, 0);
    assert.equal((await request(`/change-requests/${crId}`, 3)).status, 403);
    assert.deepEqual((await request('/change-requests', 3)).body, []);
    assert.equal((await request('/change-requests?status=submitted&crNumber=0000001&date=2026-09-14', 2)).body.length, 1);
    assert.deepEqual((await request('/change-requests?date=2020-01-01', 2)).body, []);
    assert.equal((await request('/change-requests/99999', 1)).status, 404);
    assert.equal((await request('/change-requests/bad', 1)).status, 400);
  });
  await t.test('concurrent submissions allocate distinct sequential IDs', async () => {
    const results = await Promise.all(Array.from({ length: 3 }, () => request('/change-requests', 1, { ...payload, status: 'draft' })));
    results.forEach((r) => assert.equal(r.status, 201));
    assert.equal(new Set(results.map((r) => r.body.crId)).size, 3);
    assert.equal((await request('/change-requests/next-number', 1)).body.crNumber, 'CR0000005');
    const draft = results[0].body.crId;
    assert.deepEqual((await request(`/change-requests/${draft}`, 1)).body.changeTypes, ['App']);
    assert.equal((await request(`/change-requests/${draft}/approval`, 4, { result: 'approved' })).status, 409);
  });
  await t.test('approval role checks and concurrent decisions are atomic', async () => {
    assert.equal((await request(`/change-requests/${crId}/approval`, 2, { result: 'approved' })).status, 403);
    assert.equal((await request(`/change-requests/${crId}/approval`, 4, { result: 'invalid' })).status, 400);
    const decisions = await Promise.all(['approved', 'rejected'].map((result) => request(`/change-requests/${crId}/approval`, 4, { result, comment: 'Reviewed' })));
    assert.deepEqual(decisions.map((r) => r.status).sort(), [201, 409]);
    const detail = (await request(`/change-requests/${crId}`, 1)).body;
    assert.equal(detail.approvals.length, 1);
    assert.equal(detail.approvals[0].result, detail.status);
    assert.equal(detail.approvals[0].approver, 'User 4');
  });
  await t.test('more-info mapping and notification failures preserve committed work', async () => {
    mailer.sendMail = async () => { throw new Error('Simulated email failure'); };
    // Also fail recipient lookup after commit; saving the request must still succeed.
    const store = require('../src/services/store');
    const original = store.approverEmails;
    store.approverEmails = async () => { throw new Error('Simulated lookup failure'); };
    const created = await request('/change-requests', 2, payload);
    store.approverEmails = original;
    assert.equal(created.status, 201);
    const id = created.body.crId;
    assert.equal((await request(`/change-requests/${id}/approval`, 4, { result: 'more-info' })).status, 201);
    assert.equal((await request(`/change-requests/${id}`, 2)).body.status, 'more_info');
    assert.equal((await request(`/change-requests/${id}/approval`, 4, { result: 'approved' })).status, 201);
    assert.equal((await request(`/change-requests/${id}`, 2)).body.approvals.length, 2);
    assert.ok(notifications.length >= 2);
  });
});

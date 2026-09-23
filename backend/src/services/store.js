const db = require('../db');
const rows = (s) => s.docs.map((d) => d.data());
const number = (id) => `CR${String(id).padStart(7, '0')}`;
const fail = (status, message) => Object.assign(new Error(message), { status });
const active = (u) => u.is_active === 1 || u.is_active === true;
async function getUser(id) {
  return (await db.collection('users').doc(String(Number(id))).get()).data();
}
async function findUser(username) {
  return rows(await db.collection('users').where('username', '==', username).get()).find(active);
}
async function systems() {
  return rows(await db.collection('systems').get()).filter(active)
    .sort((a, b) => a.system_name.localeCompare(b.system_name))
    .map(({ system_code, system_name }) => ({ system_code, system_name }));
}
async function nextNumber() {
  const counter = (await db.doc('counters/change_requests').get()).data();
  return number((counter?.lastId || 0) + 1);
}
async function names(cr) {
  const [user, system] = await Promise.all([
    getUser(cr.requester_id), db.collection('systems').doc(String(cr.system_id)).get(),
  ]);
  return { ...cr, requester: user?.full_name || '', system_name: system.data()?.system_name || '' };
}
async function list(user, filters) {
  let query = db.collection('change_requests');
  if (user.role === 'requester') query = query.where('requester_id', '==', user.userId);
  const requests = rows(await query.get()).filter((cr) =>
    (!filters.status || cr.status === filters.status) &&
    (!filters.date || cr.request_date === filters.date) &&
    (!filters.crNumber || cr.cr_number.toLowerCase().includes(filters.crNumber.toLowerCase()))
  ).sort((a, b) => b.cr_id - a.cr_id);
  return Promise.all(requests.map(async (cr) => {
    const item = await names(cr);
    return Object.fromEntries(['cr_id', 'cr_number', 'request_date', 'subject', 'priority', 'status', 'requester', 'system_name'].map((key) => [key, item[key]]));
  }));
}
async function detail(id, user) {
  const ref = db.collection('change_requests').doc(String(Number(id)));
  const cr = (await ref.get()).data();
  if (!cr) throw fail(404, 'CR not found');
  if (user.role === 'requester' && cr.requester_id !== user.userId) {
    throw fail(403, 'Forbidden: ดูได้เฉพาะคำขอของตัวเอง');
  }
  const approvals = rows(await ref.collection('approvals').get())
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return { ...await names(cr), approvals: await Promise.all(approvals.map(async (a) => ({
    result: a.result, comment: a.comment, approval_date: a.approval_date, signature: a.signature || null,
    approver: (await getUser(a.approver_id))?.full_name || '',
  }))) };
}
const plan = (items = []) => items.map((row) => ({
  step: row.step, start_date: row.start || null, end_date: row.end || null,
  owner: row.owner || null, note: row.note || null,
}));
async function create(body, user) {
  const matches = await db.collection('systems').where('system_code', '==', body.systemCode).limit(1).get();
  if (matches.empty) throw fail(400, 'Unknown systemCode');
  const systemId = matches.docs[0].data().system_id;
  return db.runTransaction(async (tx) => {
    const counterRef = db.doc('counters/change_requests');
    const counter = (await tx.get(counterRef)).data();
    const crId = (counter?.lastId || 0) + 1;
    if (!Number.isSafeInteger(crId)) throw fail(409, 'CR counter exhausted');
    const crNumber = number(crId);
    const now = new Date().toISOString();
    tx.create(db.collection('change_requests').doc(String(crId)), {
      cr_id: crId, cr_number: crNumber, request_date: body.requestDate || null,
      requester_id: user.userId, department: body.department || null, system_id: systemId,
      contact: body.contact || null, priority: body.priority || 'Low', subject: body.subject,
      problem: body.problem || null, request_detail: body.requestDetail || null,
      impact: body.impact || 'none', impact_detail: body.impactDetail || null,
      downtime: body.downtime ? 1 : 0, duration: body.duration || null,
      deploy_date: body.deployDate || null,
      status: body.status === 'draft' ? 'draft' : 'submitted',
      changeTypes: body.changeTypes || [],
      plan: plan(body.plan || []), rollbackPlan: plan(body.rollbackPlan || []),
      created_at: now, updated_at: now,
    });
    tx.set(counterRef, { lastId: crId });
    return { crId, crNumber };
  });
}
async function approve(id, body, user) {
  const ref = db.collection('change_requests').doc(String(Number(id)));
  const approvalRef = ref.collection('approvals').doc();
  return db.runTransaction(async (tx) => {
    const cr = (await tx.get(ref)).data();
    if (!cr) throw fail(404, 'CR not found');
    if (!['submitted', 'more_info'].includes(cr.status)) {
      throw fail(409, cr.status === 'draft'
        ? 'CR ใบนี้ยังเป็นแบบร่าง ยังไม่ได้ส่งเข้าขั้นตอนอนุมัติ'
        : 'CR ใบนี้ผ่านการพิจารณาไปแล้ว ไม่สามารถบันทึกผลซ้ำได้');
    }
    const now = new Date().toISOString();
    tx.create(approvalRef, { approver_id: user.userId, result: body.result,
      comment: body.comment || null, approval_date: body.approvalDate || null,
      signature: body.signature || null, created_at: now });
    tx.update(ref, { status: body.result === 'more-info' ? 'more_info' : body.result, updated_at: now });
    return cr;
  });
}
async function approverEmails() {
  return rows(await db.collection('users').where('role', 'in', ['approver', 'it_admin']).get())
    .filter(active).map((u) => u.email).filter(Boolean);
}
module.exports = { getUser, findUser, systems, nextNumber, list, detail, create, approve, approverEmails };

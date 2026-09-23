/**
 * @openapi
 * /api/change-requests/next-number:
 *   get:
 *     summary: เลขที่เอกสารตัวถัดไป (preview)
 *     tags: [Change Requests]
 *     security: [{ XUserId: [] }]
 *     responses:
 *       200: { description: "เลขที่เอกสาร เช่น CR0000001" }
 *       401: { description: ไม่ได้ login }
 */
/**
 * @openapi
 * /api/change-requests:
 *   get:
 *     summary: รายการ CR ทั้งหมด (filter ได้)
 *     tags: [Change Requests]
 *     security: [{ XUserId: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: crNumber
 *         schema: { type: string }
 *         description: ค้นบางส่วน (LIKE)
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: รายการ CR }
 *       401: { description: ไม่ได้ login }
 *   post:
 *     summary: บันทึก CR ใหม่
 *     tags: [Change Requests]
 *     security: [{ XUserId: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, systemCode]
 *             properties:
 *               requestDate: { type: string, format: date }
 *               department: { type: string }
 *               systemCode: { type: string }
 *               contact: { type: string }
 *               priority: { type: string }
 *               subject: { type: string }
 *               problem: { type: string }
 *               requestDetail: { type: string }
 *               impact: { type: string }
 *               impactDetail: { type: string }
 *               downtime: { type: boolean }
 *               duration: { type: string }
 *               deployDate: { type: string, format: date }
 *               status: { type: string, enum: [draft, submitted] }
 *               changeTypes:
 *                 type: array
 *                 items: { type: string }
 *               plan:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     step: { type: string }
 *                     start: { type: string, format: date }
 *                     end: { type: string, format: date }
 *                     owner: { type: string }
 *                     note: { type: string }
 *               rollbackPlan:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     step: { type: string }
 *                     start: { type: string, format: date }
 *                     end: { type: string, format: date }
 *                     owner: { type: string }
 *                     note: { type: string }
 *     responses:
 *       201: { description: สร้าง CR สำเร็จ }
 *       400: { description: ข้อมูลไม่ครบ หรือ systemCode ไม่รู้จัก }
 *       401: { description: ไม่ได้ login }
 *       409: { description: สร้างเลขที่เอกสารชนกัน ลอง submit อีกครั้ง }
 */
/**
 * @openapi
 * /api/change-requests/{id}:
 *   get:
 *     summary: ดู CR ตัวเดียว ครบทุกส่วน
 *     tags: [Change Requests]
 *     security: [{ XUserId: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: รายละเอียด CR }
 *       400: { description: Invalid CR id }
 *       401: { description: ไม่ได้ login }
 *       404: { description: CR not found }
 */
/**
 * @openapi
 * /api/change-requests/{id}/approval:
 *   post:
 *     summary: บันทึกผลพิจารณา (approver/it_admin เท่านั้น)
 *     tags: [Change Requests]
 *     security: [{ XUserId: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [result]
 *             properties:
 *               result: { type: string, enum: [approved, rejected, more-info] }
 *               comment: { type: string }
 *               approvalDate: { type: string, format: date }
 *               signature: { type: string, description: "ลายเซ็นแบบ PNG data URL" }
 *     responses:
 *       201: { description: บันทึกผลสำเร็จ }
 *       400: { description: Invalid CR id หรือ result ไม่ถูกต้อง }
 *       401: { description: ไม่ได้ login }
 *       403: { description: role ไม่มีสิทธิ์ }
 *       404: { description: CR not found }
 */
/**
 * @openapi
 * /api/change-requests/{id}:
 *   delete:
 *     summary: ลบ CR ถาวร พร้อมประวัติการพิจารณา (it_admin เท่านั้น ต้องยืนยันด้วยรหัสผ่าน)
 *     tags: [Change Requests]
 *     security: [{ XUserId: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, description: "รหัสผ่านบัญชีผู้ดูแลระบบ เพื่อยืนยันการลบ" }
 *     responses:
 *       204: { description: ลบสำเร็จ }
 *       400: { description: Invalid CR id หรือไม่ได้กรอกรหัสผ่าน }
 *       401: { description: ไม่ได้ login หรือรหัสผ่านไม่ถูกต้อง }
 *       403: { description: role ไม่มีสิทธิ์ }
 *       404: { description: CR not found }
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const store = require('../services/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendMail, renderEmail } = require('../services/mailer');
const router = express.Router();
const validId = (id) => /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0;
const wrap = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) {
    if ([400, 403, 404, 409].includes(error.status)) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};

router.get('/next-number', requireAuth, wrap(async (req, res) => {
  res.json({ crNumber: await store.nextNumber() });
}));
router.get('/', requireAuth, wrap(async (req, res) => {
  for (const key of ['status', 'crNumber', 'date']) {
    if (req.query[key] != null && typeof req.query[key] !== 'string') {
      return res.status(400).json({ error: `${key} must be a string` });
    }
  }
  res.json(await store.list(req.user, req.query));
}));
router.get('/:id', requireAuth, wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid CR id' });
  res.json(await store.detail(req.params.id, req.user));
}));

function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Invalid body';
  if (typeof body.subject !== 'string' || !body.subject.trim() || typeof body.systemCode !== 'string' || !body.systemCode) return 'ต้องมี subject, systemCode';
  for (const [key, values] of Object.entries({ priority: ['Low','Medium','High','Critical'], impact: ['none','other'] })) {
    if (body[key] != null && !values.includes(body[key])) return `${key} ต้องเป็น ${values.join('/')}`;
  }
  if (body.changeTypes != null && (!Array.isArray(body.changeTypes) || body.changeTypes.some((t) => !['App','DB','Infra'].includes(t)))) return 'changeTypes ต้องเป็น array ของ App/DB/Infra';
  for (const key of ['requestDate','department','contact','problem','requestDetail','impactDetail','duration','deployDate']) {
    if (body[key] != null && typeof body[key] !== 'string') return `${key} must be a string`;
  }
  for (const key of ['plan','rollbackPlan']) {
    if (body[key] != null && !Array.isArray(body[key])) return `${key} ต้องเป็น array`;
    for (const [i, row] of (body[key] || []).entries()) {
      if (!row || typeof row.step !== 'string' || !row.step.trim()) return `${key} แถวที่ ${i + 1} ต้องระบุขั้นตอนงาน`;
      for (const field of ['start','end','owner','note']) {
        if (row[field] != null && typeof row[field] !== 'string') return `${key}.${field} must be a string`;
      }
    }
  }
}

router.post('/', requireAuth, wrap(async (req, res) => {
  const error = validate(req.body);
  if (error) return res.status(400).json({ error });
  const result = await store.create(req.body, req.user);
  if (req.body.status !== 'draft') {
    store.approverEmails()
      .then((to) => sendMail({
        to,
        subject: `[CR] มีคำขอใหม่รอพิจารณา: ${result.crNumber}`,
        html: renderEmail({ heading: 'มีคำขอ Change Request ใหม่รอพิจารณา',
          fields: [{ label: 'เลขที่เอกสาร', value: result.crNumber }, { label: 'เรื่อง', value: req.body.subject }],
          ctaText: 'ไปหน้าพิจารณา',
          ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/approve?crId=${result.crId}`,
        }),
      }))
      .catch(() => console.error('[mailer] CR saved, but notification failed'));
  }
  res.status(201).json(result);
}));

router.post('/:id/approval', requireAuth, requireRole('approver', 'it_admin'), wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid CR id' });
  const { result, comment, approvalDate, signature } = req.body || {};
  if (!['approved', 'rejected', 'more-info'].includes(result)) return res.status(400).json({ error: 'result ต้องเป็น approved/rejected/more-info' });
  if ([comment, approvalDate, signature].some((v) => v != null && typeof v !== 'string')) return res.status(400).json({ error: 'comment, approvalDate and signature must be strings' });
  if (signature && !/^data:image\/png;base64,/.test(signature)) return res.status(400).json({ error: 'signature ต้องเป็น PNG data URL' });
  if (signature && signature.length > 500000) return res.status(400).json({ error: 'signature มีขนาดใหญ่เกินไป' });
  const cr = await store.approve(req.params.id, req.body, req.user);
  store.getUser(cr.requester_id)
    .then((user) => {
      const resultText = { approved: 'อนุมัติ', rejected: 'ไม่อนุมัติ', 'more-info': 'ขอข้อมูลเพิ่มเติม' }[result];
      return sendMail({ to: user?.email,
        subject: `[CR] ผลการพิจารณา ${cr.cr_number}: ${resultText}`,
        html: renderEmail({ heading: `ผลการพิจารณาคำขอ ${cr.cr_number}`, statusText: resultText,
          statusColor: { approved: '#16a34a', rejected: '#dc2626', 'more-info': '#d97706' }[result],
          fields: [{ label: 'เรื่อง', value: cr.subject }, ...(comment ? [{ label: 'ความเห็น', value: comment }] : [])],
        }),
      });
    })
    .catch(() => console.error('[mailer] Approval saved, but notification failed'));
  res.status(201).json({ ok: true });
}));

router.delete('/:id', requireAuth, requireRole('it_admin'), wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid CR id' });
  const { password } = req.body || {};
  if (typeof password !== 'string' || !password) return res.status(400).json({ error: 'ต้องกรอกรหัสผ่านเพื่อยืนยันการลบ' });
  const user = await store.getUser(req.user.userId);
  if (!user || typeof user.password_hash !== 'string' || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
  }
  await store.remove(req.params.id);
  res.status(204).end();
}));
module.exports = router;

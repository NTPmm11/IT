// ============================================
// routes/cr.js — CRUD change requests + approval
// ============================================
//
// ★ LAB 4 — ไฟล์ใหญ่สุด (ต้องผ่าน LAB 1-3 มาก่อน)
//
// มี 4 เส้น:
//   GET  /api/change-requests            ดูรายการ CR ทั้งหมด   ← ทำให้ดูเป็นตัวอย่างแล้ว
//   GET  /api/change-requests/:id        ดู CR ตัวเดียว          ← LAB 4A
//   POST /api/change-requests            บันทึก CR ใหม่          ← LAB 4B (พีคสุด: transaction)
//   POST /api/change-requests/:id/approval  บันทึกผลพิจารณา     ← LAB 4C
//
// mapping กับ database/*.sql:
//   change_requests    = ฟอร์ม section 1-3
//   cr_change_types    = checkbox ประเภทการเปลี่ยน (หลายค่า)
//   cr_action_plans    = ตารางแผนดำเนินงาน section 4
//   cr_rollback_plans  = ตารางแผนการกู้คืน (Roll Back Plan) — โครงเหมือน cr_action_plans
//   cr_approvals       = ผลพิจารณา section 5 (approve.html)
//
// ติดตรงไหนดูเฉลย:  git diff main solution -- backend/src/routes/cr.js
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง: index.js -> app.use("/api/change-requests", crRoutes)
// ปลายทาง (require เข้ามาใช้):
//   ../db                    คุยกับตาราง change_requests / cr_change_types / cr_action_plans /
//                            cr_rollback_plans / cr_approvals
//   ../middleware/auth       requireAuth (ต้อง login) + requireRole (เช็คสิทธิ์ approver/it_admin)
//   ../services/mailer       ส่งเมลแจ้งเตือนหลัง submit/หลังพิจารณาผล (sendMail + renderEmail ทำ HTML สวยๆ)
// ฝั่ง frontend ที่เรียกเส้นต่างๆ ในไฟล์นี้:
//   views/FormView.vue           -> POST /  (submit CR ใหม่) + GET /next-number (preview เลขที่)
//   views/ListView.vue           -> GET /   (list + filter)
//   views/ApproveView.vue        -> GET /:id (ดึงรายละเอียด CR มาโชว์ก่อนอนุมัติ)
//   components/ApprovalSection.vue -> POST /:id/approval (บันทึกผลพิจารณา)

const express = require("express");
const dbPool = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sendMail, renderEmail } = require("../services/mailer");

const router = express.Router();

// ============================================
// GET /api/change-requests/next-number — เลขที่เอกสารตัวถัดไป (preview ก่อน submit จริง)
// ============================================
// ต้องอยู่ก่อน "/:id" ไม่งั้น Express จะจับ "next-number" เป็นค่า :id ไปแทน
// เป็นแค่ preview (MAX(cr_id)+1) — ถ้ามีคนอื่น submit แทรกก่อน เลขจริงตอน submit
// อาจไม่ตรงกับที่ preview ไว้ (ยอมรับ trade-off นี้ เพื่อแลกกับไม่ต้อง insert แถวจริงล่วงหน้า)
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
router.get("/next-number", requireAuth, async (req, res, next) => {
  try {
    const [[row]] = await dbPool.query(
      "SELECT ISNULL(MAX(cr_id), 0) + 1 AS nextId FROM change_requests"
    );
    res.json({ crNumber: `CR${String(row.nextId).padStart(7, "0")}` });
  } catch (err) {
    next(err);
  }
});

// ============================================
// GET /api/change-requests — list ทั้งหมด
// ★ เส้นนี้ทำให้ดูเป็นตัวอย่างเต็มๆ — อ่านให้เข้าใจก่อนทำเส้นอื่น
// ============================================
// สังเกต requireAuth คั่นกลาง = ต้องแนบ token มาถึงจะผ่านเข้ามาได้
// query string รองรับ filter (ทั้งหมด optional, ใส่กี่ตัวพร้อมกันก็ได้):
//   ?status=approved            ตรงตัว
//   ?crNumber=CR6908           ค้นบางส่วน (LIKE)
//   ?date=2026-07-24           ตรงกับ request_date
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
router.get("/", requireAuth, async (req, res, next) => {
  try {
    // JOIN = ดึงข้ามตาราง:
    // ตาราง cr เก็บแค่ "รหัส" คนขอ (requester_id) กับรหัสระบบ (system_id)
    // อยากได้ "ชื่อ" ต้องไปเปิดตาราง users กับ systems ประกอบ
    // ON บอกว่าจับคู่แถวกันด้วยเงื่อนไขอะไร
    // AS = ตั้งชื่อเล่นให้ column ตอนตอบกลับ (u.full_name -> requester)
    const { status, crNumber, date } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push("cr.status = ?");
      params.push(status);
    }
    if (crNumber) {
      conditions.push("cr.cr_number LIKE ?");
      params.push(`%${crNumber}%`);
    }
    if (date) {
      conditions.push("cr.request_date = ?");
      params.push(date);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [crRows] = await dbPool.query(
      `SELECT cr.cr_id, cr.cr_number, cr.request_date, cr.subject, cr.priority,
              cr.status, u.full_name AS requester, s.system_name
       FROM change_requests cr
       JOIN users u   ON u.user_id = cr.requester_id
       JOIN systems s ON s.system_id = cr.system_id
       ${where}
       ORDER BY cr.created_at DESC`,   // เรียงใหม่สุดขึ้นก่อน
      params
    );
    res.json(crRows);
  } catch (err) {
    next(err);
  }
});

// ============================================
// LAB 4A: GET /api/change-requests/:id — CR ตัวเดียว ครบทุกส่วน
// ============================================
// :id = ตัวแปรใน URL เช่นเรียก /api/change-requests/7
// ค่า 7 จะโผล่ใน req.params.id
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
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    // req.params.id = ค่าจาก :id ใน URL (มาจากชื่อตัวแปรใน path "/:id" ด้านบน)
    const crId = req.params.id;
    // id ต้องเป็นเลขล้วนเท่านั้น (cr_id เป็น INT) — ไม่งั้นส่งไปให้ SQL Server แปลงเอง
    // จะได้ error "Conversion failed" โผล่เป็น 500 แทนที่จะเป็น 400 ที่ตรงกว่า
    if (!/^\d+$/.test(crId)) {
      return res.status(400).json({ error: "Invalid CR id" });
    }

    // [[cr]] คือ destructure ซ้อน 2 ชั้น:
    //   dbPool.query คืนแถวผลลัพธ์เป็น array ก้อนแรก (เหมือน crRows/userRows/systemRows ที่อื่นในไฟล์นี้)
    //   ชั้นสองดึงแถวแรกออกจาก array นั้นมาตั้งชื่อว่า cr ตรงๆ เลย (เจอ 1 CR ก็พอ ไม่ต้องมีทั้ง array)
    // เท่ากับเขียนยาวว่า: const [crRows] = await dbPool.query(...); const cr = crRows[0];
    const [[cr]] = await dbPool.query(
      `SELECT cr.cr_id, cr.cr_number, cr.request_date, cr.department, cr.contact,
              cr.priority, cr.subject, cr.problem, cr.request_detail,
              cr.impact, cr.impact_detail, cr.downtime, cr.duration, cr.deploy_date,
              cr.status, cr.created_at,
              u.full_name AS requester, s.system_name
       FROM change_requests cr
       JOIN users u   ON u.user_id = cr.requester_id
       JOIN systems s ON s.system_id = cr.system_id
       WHERE cr.cr_id = ?`,
      [crId]
    );

    if (!cr) {
      return res.status(404).json({ error: "CR not found" });
    }

    // CR หนึ่งใบมีได้หลายประเภทการเปลี่ยน (checkbox) และหลายขั้นตอนแผนงาน (ตาราง)
    // เก็บแยกคนละตาราง (1 CR ต่อหลายแถว) เลยต้อง query แยกจากตัวหลัก แล้วค่อยประกอบกลับ
    const [types] = await dbPool.query(
      "SELECT change_type FROM cr_change_types WHERE cr_id = ?",
      [crId]
    );
    const [plans] = await dbPool.query(
      "SELECT step, start_date, end_date, owner, note FROM cr_action_plans WHERE cr_id = ? ORDER BY seq_no",
      [crId]
    );
    const [rollbackPlans] = await dbPool.query(
      "SELECT step, start_date, end_date, owner, note FROM cr_rollback_plans WHERE cr_id = ? ORDER BY seq_no",
      [crId]
    );
    const [approvals] = await dbPool.query(
      `SELECT a.result, a.comment, a.approval_date, u.full_name AS approver
       FROM cr_approvals a
       JOIN users u ON u.user_id = a.approver_id
       WHERE a.cr_id = ?`,
      [crId]
    );

    res.json({
      ...cr,   // "spread" เอาทุก field ของ cr มากางใส่ object ใหม่นี้เลย (cr_id, subject, status, ...)
      // types เป็น array ของ object เช่น [{change_type:"App"}, {change_type:"DB"}]
      // .map ดึงเอาแค่ค่า change_type ออกมาเหลือ array string ธรรมดา ["App","DB"]
      changeTypes: types.map(t => t.change_type),
      plan: plans,
      rollbackPlan: rollbackPlans,
      approvals
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// LAB 4B: POST /api/change-requests — บันทึก CR ใหม่ (โจทย์พีคสุด)
// ============================================
// body ที่ frontend/js/form.js จะส่งมา:
// { requestDate, department, systemCode, contact, priority,
//   subject, problem, requestDetail, impact, impactDetail, downtime,
//   duration, deployDate, changeTypes: [], plan: [], status }
// (ไม่ต้องส่ง crNumber มาแล้ว — backend สร้างให้เองจาก cr_id ที่เพิ่ง insert ได้)
//
// ★ concept ใหม่: transaction
// งานนี้ต้อง INSERT 3 ตาราง (CR + ประเภท + แผนงาน)
// ถ้าตารางแรกสำเร็จแล้วตารางถัดไปพัง = ข้อมูลค้างครึ่งๆ กลางๆ
// transaction = "ทำทั้งหมด หรือไม่ทำเลยสักอย่าง":
//   dbConnection.beginTransaction()  เริ่มจดแบบร่าง
//   dbConnection.commit()            พอใจแล้ว บันทึกจริงทั้งหมด
//   dbConnection.rollback()          พังกลางทาง ยกเลิกแบบร่างทั้งหมด
// transaction ต้องอยู่บน connection เส้นเดียวกันตลอด
// เลยต้องจองจากสระ: const dbConnection = await dbPool.getConnection()
// (แล้วใช้ dbConnection.query แทน dbPool.query ทุกที่ในเส้นนี้)
router.post("/", requireAuth, async (req, res, next) => {
  // จองตัวคุยกับ database มา "1 เส้น" ตายตัวสำหรับ request นี้
  // (ต่างจาก dbPool.query ที่ปกติสุ่มยืมเส้นว่างจากสระ — transaction ต้องใช้เส้นเดียวกันตลอด)
  const dbConnection = await dbPool.getConnection();
  try {
    const body = req.body;   // เก็บไว้ตัวแปรสั้นๆ เพราะต้องอ้างถึงหลายรอบด้านล่าง

    // เช็คฟิลด์ที่ "ต้องมี" ก่อนแตะ database เลย ประหยัด query ที่ไม่จำเป็น
    // cr_number ไม่ต้องรับจาก frontend แล้ว — backend สร้างให้เองจาก cr_id หลัง insert (ดูล่าง)
    if (!body.subject || !body.systemCode) {
      return res.status(400).json({ error: "ต้องมี subject, systemCode" });
    }

    // frontend ส่ง systemCode (ข้อความ เช่น "HR01") มา แต่ตาราง change_requests
    // ต้องการ system_id (เลข FK) เลยต้อง query แปลงค่าก่อน 1 รอบ
    const [systemRows] = await dbConnection.query(
      "SELECT system_id FROM systems WHERE system_code = ?",
      [body.systemCode]
    );
    if (!systemRows[0]) {
      return res.status(400).json({ error: "Unknown systemCode" });
    }
    const systemId = systemRows[0].system_id;

    await dbConnection.beginTransaction();

    // cr_number เป็น NOT NULL UNIQUE ตั้งแต่ insert แถวแรก แต่เลข cr_id (IDENTITY) จะรู้ค่าจริง
    // ก็ต่อเมื่อ insert ไปแล้วเท่านั้น — เลยใส่ค่ากันชนคาดคะเนไปก่อน (unique ชั่วคราว)
    // แล้วค่อย UPDATE ทับด้วยเลขที่จริง "CRxxxxxxx" อีกที
    const tempCrNumber = `TEMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // INSERT ตารางหลัก — จำนวน "?" ต้องตรงกับจำนวนคอลัมน์และเรียงลำดับเดียวกับ array ด้านล่างเป๊ะๆ
    const [result] = await dbConnection.query(
      `INSERT INTO change_requests
        (cr_number, request_date, requester_id, department, system_id, contact,
         priority, subject, problem, request_detail, impact, impact_detail,
         downtime, duration, deploy_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tempCrNumber,
        body.requestDate || null,  // request_date DATE NULL — "" (ลบ input date ออก) แปลงเป็น DATE ตรงๆ ไม่ได้ พังทันที
        req.user.userId,       // ไม่เชื่อ requesterId ที่ frontend ส่งมา — ใช้ user ที่ login จริงจาก requireAuth เท่านั้น
        body.department || null,  // "||" = ถ้าค่าซ้าย falsy (undefined/"") ใช้ค่าขวาแทน (คอลัมน์นี้ยอมเป็น NULL ได้)
        systemId,
        body.contact || null,
        body.priority || "Low",
        body.subject,
        body.problem || null,
        body.requestDetail || null,
        body.impact || "none",
        body.impactDetail || null,
        body.downtime ? 1 : 0,    // BIT ใน SQL Server เก็บ 0/1 — แปลง true/false ของ JS ให้ตรงชนิด
        body.duration || null,
        body.deployDate || null,
        body.status === "draft" ? "draft" : "submitted"   // ค่าอื่นนอกจาก "draft" ถือเป็น submit ทันที
      ]
    );
    const crId = result.insertId;   // เลขที่ IDENTITY เพิ่งแจก (auto-increment primary key ของแถวที่เพิ่ง insert)

    // มีเลข cr_id จริงแล้ว -> สร้างเลขที่เอกสารรูปแบบ CR0000001 (CR + เลข 7 หลัก) แล้วอัปเดตทับ temp
    const crNumber = `CR${String(crId).padStart(7, "0")}`;
    await dbConnection.query(
      "UPDATE change_requests SET cr_number = ? WHERE cr_id = ?",
      [crNumber, crId]
    );

    // checkbox "ประเภทการเปลี่ยน" ผู้ใช้ติ๊กได้หลายอัน -> insert วนทีละแถว (1 ประเภท = 1 แถว)
    // "|| []" กันกรณี frontend ไม่ส่ง changeTypes มาเลย (undefined) ไม่งั้น for...of พังทันที
    for (const type of body.changeTypes || []) {
      await dbConnection.query(
        "INSERT INTO cr_change_types (cr_id, change_type) VALUES (?, ?)",
        [crId, type]
      );
    }

    // ตารางแผนงานก็เหมือนกัน วนทีละแถวจาก body.plan (array ที่ frontend ส่งมาจากตาราง Action Plan)
    // seq++ = เอาค่าปัจจุบันไปใช้ก่อน แล้วค่อยบวก 1 (แถวแรก seq_no=1, แถวถัดไป 2, 3, ...)
    let seq = 1;
    for (const row of body.plan || []) {
      await dbConnection.query(
        `INSERT INTO cr_action_plans (cr_id, seq_no, step, start_date, end_date, owner, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crId, seq++, row.step, row.start, row.end, row.owner || null, row.note || null]
      );
    }

    // ตาราง "แผนการกู้คืน (Roll Back Plan)" — โครงเหมือน action plan เป๊ะ แค่คนละตาราง (cr_rollback_plans)
    // seq นับแยกชุดของตัวเอง เริ่ม 1 ใหม่ (ไม่ต่อจาก action plan)
    let rollbackSeq = 1;
    for (const row of body.rollbackPlan || []) {
      await dbConnection.query(
        `INSERT INTO cr_rollback_plans (cr_id, seq_no, step, start_date, end_date, owner, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crId, rollbackSeq++, row.step, row.start, row.end, row.owner || null, row.note || null]
      );
    }

    await dbConnection.commit();   // ทุก INSERT ด้านบนสำเร็จหมด -> บันทึกจริงลง database พร้อมกันทีเดียว

    // ส่ง e-mail แจ้งผู้อนุมัติ — เฉพาะตอน submit จริง (draft ยังไม่ต้องแจ้งใคร)
    // ไม่ await ให้ล้มทั้ง request ถ้าส่งอีเมลพลาด — sendMail จัดการ catch ข้างในเองแล้ว (ดู services/mailer.js)
    if (body.status !== "draft") {
      const [approvers] = await dbPool.query(
        "SELECT email FROM users WHERE role IN ('approver','it_admin') AND is_active = 1"
      );
      const approveLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/approve?crId=${crId}`;
      sendMail({
        to: approvers.map(a => a.email),
        subject: `[CR] มีคำขอใหม่รอพิจารณา: ${crNumber}`,
        html: renderEmail({
          heading: "มีคำขอ Change Request ใหม่รอพิจารณา",
          fields: [
            { label: "เลขที่เอกสาร", value: `<b>${crNumber}</b>`, raw: true },
            { label: "เรื่อง", value: body.subject }
          ],
          ctaText: "ไปหน้าพิจารณา",
          ctaUrl: approveLink
        })
      });
    }

    res.status(201).json({ crId, crNumber });   // 201 Created = สร้างข้อมูลใหม่สำเร็จ
  } catch (err) {
    await dbConnection.rollback();   // ยกเลิกทุก INSERT ใน transaction (คืนสภาพเหมือนไม่เคยมีอะไรเกิดขึ้น)
    if (err.code === "ER_DUP_ENTRY") {
      // ชนกับ temp cr_number ของ request อื่นที่วิ่งพร้อมกันพอดี (โอกาสน้อยมาก) — ลองใหม่อีกทีได้เลย
      return res.status(409).json({ error: "สร้างเลขที่เอกสารชนกัน ลอง submit อีกครั้ง" });   // 409 Conflict
    }
    next(err);
  } finally {
    // finally = ทำเสมอไม่ว่าสำเร็จหรือพัง
    // คืน connection กลับสระ — ลืมคืนบ่อยเข้าสระแห้ง ทั้งระบบค้าง
    dbConnection.release();
  }
});

// ============================================
// LAB 4C: POST /api/change-requests/:id/approval — บันทึกผลพิจารณา
// ============================================
// สังเกตด่าน 2 ชั้น: requireAuth แล้วต่อด้วย requireRole
// role requester หลุดมาถึงนี่จะโดน 403 เด้งกลับ (ฝีมือ LAB 3.4)
// body: { result: "approved"|"rejected"|"more-info", comment, approvalDate }
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
 *     responses:
 *       201: { description: บันทึกผลสำเร็จ }
 *       400: { description: Invalid CR id หรือ result ไม่ถูกต้อง }
 *       401: { description: ไม่ได้ login }
 *       403: { description: role ไม่มีสิทธิ์ }
 *       404: { description: CR not found }
 */
router.post("/:id/approval", requireAuth, requireRole("approver", "it_admin"),
  async (req, res, next) => {
    // เส้นนี้แตะ 2 ตาราง (เพิ่มผลพิจารณา + อัปเดตสถานะใบ CR)
    // เลยใช้ transaction เหมือน LAB 4B
    const dbConnection = await dbPool.getConnection();
    try {
      const crId = req.params.id;
      // req.body ของเส้นนี้: { result, comment, approvalDate }
      const { result, comment, approvalDate } = req.body;

      // id ต้องเป็นเลขล้วนเท่านั้น (cr_id เป็น INT) เหมือน GET /:id ด้านบน
      if (!/^\d+$/.test(crId)) {
        return res.status(400).json({ error: "Invalid CR id" });
      }

      // whitelist ค่าที่ยอมรับ — กันคนส่ง result มั่วๆ เข้ามาปนใน database
      if (!["approved", "rejected", "more-info"].includes(result)) {
        return res.status(400).json({ error: "result ต้องเป็น approved/rejected/more-info" });
      }

      // เช็คก่อนว่า CR เลขนี้มีอยู่จริงไหม ก่อนจะเริ่ม transaction
      // (ดึง cr_number/subject/email ผู้ร้องขอมาด้วยเลย เอาไว้ส่ง e-mail แจ้งผลหลัง commit)
      const [crRows] = await dbConnection.query(
        `SELECT cr.cr_id, cr.cr_number, cr.subject, u.email AS requesterEmail
         FROM change_requests cr
         JOIN users u ON u.user_id = cr.requester_id
         WHERE cr.cr_id = ?`,
        [crId]
      );
      if (!crRows[0]) {
        return res.status(404).json({ error: "CR not found" });
      }

      await dbConnection.beginTransaction();

      // แถวที่ 1: บันทึกผลพิจารณาลงตาราง cr_approvals (ใครอนุมัติ ผลอะไร คอมเมนต์อะไร)
      await dbConnection.query(
        `INSERT INTO cr_approvals (cr_id, approver_id, result, comment, approval_date)
         VALUES (?, ?, ?, ?, ?)`,
        [crId, req.user.userId, result, comment || null, approvalDate || null]  // approval_date DATE NULL — ช่องนี้ไม่ required ฝั่งหน้าเว็บ ต้องกัน "" เอง
      );

      // enum ใน schema ใช้ขีดล่าง แต่หน้าเว็บส่งขีดกลางมา (more-info -> more_info)
      const statusValue = result === "more-info" ? "more_info" : result;
      // แถวที่ 2: อัปเดตสถานะปัจจุบันของใบ CR เอง ให้ตรงกับผลล่าสุด
      await dbConnection.query(
        "UPDATE change_requests SET status = ?, updated_at = GETDATE() WHERE cr_id = ?",
        [statusValue, crId]
      );

      await dbConnection.commit();   // ทั้ง INSERT และ UPDATE สำเร็จพร้อมกัน — ถ้าอันใดพัง อีกอันจะไม่ถูกบันทึกด้วย (ดู catch ด้านล่าง)

      // ส่ง e-mail แจ้งผลกลับไปยังผู้ร้องขอ (ไม่ await ให้บล็อก response — sendMail catch เองแล้ว)
      const resultText = { approved: "อนุมัติ", rejected: "ไม่อนุมัติ", "more-info": "ขอข้อมูลเพิ่มเติม" }[result];
      const resultColor = { approved: "#16a34a", rejected: "#dc2626", "more-info": "#d97706" }[result];
      const cr = crRows[0];

      const fields = [{ label: "เรื่อง", value: cr.subject }];
      if (comment) fields.push({ label: "ความเห็น", value: comment });

      sendMail({
        to: cr.requesterEmail,
        subject: `[CR] ผลการพิจารณา ${cr.cr_number}: ${resultText}`,
        html: renderEmail({
          heading: `ผลการพิจารณาคำขอ ${cr.cr_number}`,
          statusText: resultText,
          statusColor: resultColor,
          fields
        })
      });

      res.status(201).json({ ok: true });
    } catch (err) {
      await dbConnection.rollback();
      next(err);
    } finally {
      dbConnection.release();
    }
  });

module.exports = router;

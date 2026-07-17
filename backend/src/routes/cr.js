// ============================================
// routes/cr.js — CRUD change requests + approval
// ============================================
//
// ไฟล์ใหญ่สุดของ backend — มี 4 เส้น:
//   GET  /api/change-requests            ดูรายการ CR ทั้งหมด
//   GET  /api/change-requests/:id        ดู CR ตัวเดียว (ครบทุกส่วน)
//   POST /api/change-requests            บันทึก CR ใหม่ (จากหน้า form)
//   POST /api/change-requests/:id/approval  บันทึกผลพิจารณา (จากหน้า approve)
//
// mapping กับ database/schema.sql:
//   change_requests  = ฟอร์ม section 1-3
//   cr_change_types  = checkbox ประเภทการเปลี่ยน (หลายค่า)
//   cr_action_plans  = ตารางแผนดำเนินงาน section 4
//   cr_approvals     = ผลพิจารณา section 5 (approve.html)

const express = require("express");
const pool = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// ============================================
// GET /api/change-requests — list ทั้งหมด
// ============================================
// สังเกต requireAuth คั่นกลาง = ต้องแนบ token มาถึงจะผ่านเข้ามาได้
router.get("/", requireAuth, async (req, res, next) => {
  try {
    // JOIN = ดึงข้ามตาราง:
    // ตาราง cr เก็บแค่ "รหัส" คนขอ (requester_id) กับรหัสระบบ (system_id)
    // อยากได้ "ชื่อ" ต้องไปเปิดตาราง users กับ systems ประกอบ
    // ON บอกว่าจับคู่แถวกันด้วยเงื่อนไขอะไร
    // AS = ตั้งชื่อเล่นให้ column ตอนตอบกลับ (u.full_name -> requester)
    const [rows] = await pool.query(
      `SELECT cr.cr_id, cr.cr_number, cr.request_date, cr.subject, cr.priority,
              cr.status, u.full_name AS requester, s.system_name
       FROM change_requests cr
       JOIN users u   ON u.user_id = cr.requester_id
       JOIN systems s ON s.system_id = cr.system_id
       ORDER BY cr.created_at DESC`   // เรียงใหม่สุดขึ้นก่อน
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ============================================
// GET /api/change-requests/:id — CR ตัวเดียว ครบทุกส่วน
// ============================================
// :id = ตัวแปรใน URL เช่นเรียก /api/change-requests/7
// ค่า 7 จะโผล่ใน req.params.id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const crId = req.params.id;

    // [[cr]] = วงเล็บซ้อน 2 ชั้น: ชั้นนอกหยิบก้อนแถวข้อมูล
    // ชั้นในหยิบแถวแรกเลย (เพราะค้นด้วย id ได้แค่แถวเดียวอยู่แล้ว)
    const [[cr]] = await pool.query(
      `SELECT cr.*, u.full_name AS requester_name, s.system_name
       FROM change_requests cr
       JOIN users u   ON u.user_id = cr.requester_id
       JOIN systems s ON s.system_id = cr.system_id
       WHERE cr.cr_id = ?`,
      [crId]
    );
    // ไม่เจอ = id นี้ไม่มีจริง -> 404
    if (!cr) return res.status(404).json({ error: "CR not found" });

    // CR 1 ใบมีข้อมูลกระจายอยู่ 4 ตาราง — ดึงส่วนที่เหลือมาประกอบ
    const [types] = await pool.query(
      "SELECT change_type FROM cr_change_types WHERE cr_id = ?", [crId]);
    const [plans] = await pool.query(
      "SELECT seq_no, step, start_date, end_date, owner, note FROM cr_action_plans WHERE cr_id = ? ORDER BY seq_no", [crId]);
    const [approvals] = await pool.query(
      `SELECT a.result, a.comment, a.approval_date, u.full_name AS approver
       FROM cr_approvals a JOIN users u ON u.user_id = a.approver_id
       WHERE a.cr_id = ? ORDER BY a.created_at DESC`, [crId]);

    // ประกอบร่างตอบกลับเป็นก้อนเดียว
    // ...cr = แผ่ทุก field ของ cr ออกมาวางตรงนี้
    // types เป็น array ของ object [{change_type:"App"},...]
    // .map แปลงให้เหลือ ["App", ...] เฉยๆ ให้ frontend ใช้ง่าย
    res.json({
      ...cr,
      changeTypes: types.map(t => t.change_type),
      plan: plans,
      approvals
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// POST /api/change-requests — บันทึก CR ใหม่
// ============================================
// body ที่รอรับ (frontend/js/form.js เป็นคนส่ง):
// { crNumber, requestDate, department, systemCode, contact, priority,
//   subject, problem, requestDetail, impact, impactDetail, downtime,
//   duration, deployDate, changeTypes: [], plan: [], status }
router.post("/", requireAuth, async (req, res, next) => {
  // งานนี้ต้อง INSERT 3 ตาราง (CR + ประเภท + แผนงาน)
  // ถ้าตารางแรกสำเร็จแล้วตารางถัดไปพัง = ข้อมูลค้างครึ่งๆ กลางๆ
  //
  // ทางแก้ = transaction: "ทำทั้งหมด หรือไม่ทำเลยสักอย่าง"
  //   beginTransaction = เริ่มจดทุกอย่างแบบร่าง
  //   commit           = พอใจแล้ว บันทึกจริงทั้งหมด
  //   rollback         = พังกลางทาง ยกเลิกแบบร่างทั้งหมด
  //
  // transaction ต้องทำบน connection เส้นเดียวกันตลอด
  // เลยหยิบมาจองจากสระ 1 เส้น (pool.query เฉยๆ ใช้เส้นไหนก็ได้ ใช้กับงานนี้ไม่ได้)
  const conn = await pool.getConnection();
  try {
    const b = req.body;   // ตั้งชื่อสั้นๆ จะได้ไม่ต้องพิมพ์ req.body ยาวๆ ทุกที่

    // เช็คของที่ขาดไม่ได้ก่อนเริ่มบันทึก
    if (!b.crNumber || !b.subject || !b.systemCode) {
      return res.status(400).json({ error: "crNumber, subject and systemCode are required" });
    }

    // dropdown ส่งมาเป็น code เช่น "web-portal"
    // แต่ตาราง change_requests เก็บเป็นตัวเลข system_id -> แปลงก่อน
    const [[system]] = await conn.query(
      "SELECT system_id FROM systems WHERE system_code = ?", [b.systemCode]);
    if (!system) return res.status(400).json({ error: "Unknown systemCode" });

    // ── เริ่ม transaction ตรงนี้ ──
    await conn.beginTransaction();

    // ตารางที่ 1: ใบ CR หลัก
    // || null = ช่องไหนไม่ได้กรอก เก็บเป็น NULL (ค่าว่างของ database)
    const [result] = await conn.query(
      `INSERT INTO change_requests
        (cr_number, request_date, requester_id, department, system_id, contact,
         priority, subject, problem, request_detail, impact, impact_detail,
         downtime, duration, deploy_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.crNumber,
        b.requestDate || new Date(),      // ไม่ระบุวันที่ = ใช้วันนี้
        req.user.userId,                  // คนบันทึก = คนที่ login อยู่ (จาก token
                                          // ไม่เชื่อค่าจาก body — ปลอมง่าย)
        b.department || null,
        system.system_id,
        b.contact || null,
        b.priority || "Low",
        b.subject,
        b.problem || null,
        b.requestDetail || null,
        b.impact || "none",
        // เก็บรายละเอียดผลกระทบเฉพาะตอนเลือก "กระทบระบบอื่น"
        b.impact === "other" ? b.impactDetail : null,
        b.downtime ? 1 : 0,               // MySQL ไม่มี true/false ใช้ 1/0 แทน
        b.duration || null,
        b.deployDate || null,
        // ปุ่มบันทึกร่างส่ง "draft" มา / ปุ่ม Submit = "submitted"
        b.status === "draft" ? "draft" : "submitted"
      ]
    );
    // insertId = เลข id ที่ database เพิ่งแจกให้แถวใหม่ (AUTO_INCREMENT)
    // ตารางลูกทั้งหมดต้องใช้เลขนี้อ้างกลับมาหาใบ CR
    const crId = result.insertId;

    // ตารางที่ 2: ประเภทการเปลี่ยน — ติ๊กกี่อันก็ INSERT เท่านั้นแถว
    // (b.changeTypes || [] = เผื่อไม่ติ๊กเลย จะได้ array ว่าง วนศูนย์รอบ ไม่พัง)
    for (const type of b.changeTypes || []) {
      await conn.query(
        "INSERT INTO cr_change_types (cr_id, change_type) VALUES (?, ?)",
        [crId, type]);
    }

    // ตารางที่ 3: แผนดำเนินงาน — 1 แถวบนหน้าเว็บ = 1 record
    // seq++ = ใช้ค่าแล้วค่อยบวก: แถวแรกได้ 1, แถวต่อไป 2, 3, ...
    let seq = 1;
    for (const row of b.plan || []) {
      await conn.query(
        `INSERT INTO cr_action_plans (cr_id, seq_no, step, start_date, end_date, owner, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crId, seq++, row.step, row.start, row.end, row.owner || null, row.note || null]);
    }

    // ── ทุกอย่างรอด บันทึกจริงทั้งหมด ──
    await conn.commit();

    // 201 = "สร้างของใหม่สำเร็จ" — ตอบ crId กลับไป
    // (form.js เอาไปต่อท้าย URL หน้า approve: approve.html?crId=...)
    res.status(201).json({ crId, crNumber: b.crNumber });
  } catch (err) {
    // พังตรงไหนก็ตาม -> ยกเลิกทุก INSERT ที่ทำไปใน transaction นี้
    await conn.rollback();

    // ER_DUP_ENTRY = ชนกฎ UNIQUE ของ cr_number (เลขเอกสารซ้ำกับใบเก่า)
    // 409 = "ข้อมูลชนกับของที่มีอยู่"
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "CR number already exists" });
    }
    next(err);
  } finally {
    // finally = ทำเสมอไม่ว่าสำเร็จหรือพัง
    // คืน connection กลับสระ — ลืมคืนบ่อยเข้าสระแห้ง ทั้งระบบค้าง
    conn.release();
  }
});

// ============================================
// POST /api/change-requests/:id/approval — บันทึกผลพิจารณา
// ============================================
// สังเกตด่าน 2 ชั้น: requireAuth (login หรือยัง)
// แล้วต่อด้วย requireRole (เป็น approver หรือ it_admin ไหม)
// role requester หลุดมาถึงนี่จะโดน 403 เด้งกลับ
// body: { result: "approved"|"rejected"|"more-info", comment, approvalDate }
router.post("/:id/approval", requireAuth, requireRole("approver", "it_admin"),
  async (req, res, next) => {
    // เส้นนี้ก็แตะ 2 ตาราง (เพิ่มผลพิจารณา + อัปเดตสถานะใบ CR)
    // เลยใช้ transaction เหมือนกัน
    const conn = await pool.getConnection();
    try {
      const crId = req.params.id;
      const { result, comment, approvalDate } = req.body;

      // กันค่ามั่ว — result ต้องเป็น 1 ใน 3 ค่านี้เท่านั้น
      if (!["approved", "rejected", "more-info"].includes(result)) {
        return res.status(400).json({ error: "result must be approved, rejected or more-info" });
      }

      // เช็คก่อนว่าใบ CR นี้มีจริง
      const [[cr]] = await conn.query(
        "SELECT cr_id FROM change_requests WHERE cr_id = ?", [crId]);
      if (!cr) return res.status(404).json({ error: "CR not found" });

      await conn.beginTransaction();

      // บันทึกผลพิจารณาเป็นแถวใหม่ (เก็บเป็นประวัติ — พิจารณากี่รอบก็เก็บหมด)
      // คนอนุมัติ = คนที่ login อยู่ เอาจาก token เช่นเดิม
      await conn.query(
        `INSERT INTO cr_approvals (cr_id, approver_id, result, comment, approval_date)
         VALUES (?, ?, ?, ?, ?)`,
        [crId, req.user.userId, result, comment || null, approvalDate || new Date()]);

      // อัปเดตสถานะบนใบ CR หลักให้ตรงกับผล
      // (แปลง "more-info" เป็น "more_info" เพราะ enum ใน schema ใช้ขีดล่าง)
      await conn.query(
        "UPDATE change_requests SET status = ? WHERE cr_id = ?",
        [result === "more-info" ? "more_info" : result, crId]);

      await conn.commit();
      res.status(201).json({ ok: true });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  });

module.exports = router;

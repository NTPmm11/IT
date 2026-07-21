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
// mapping กับ database/schema.sql:
//   change_requests  = ฟอร์ม section 1-3
//   cr_change_types  = checkbox ประเภทการเปลี่ยน (หลายค่า)
//   cr_action_plans  = ตารางแผนดำเนินงาน section 4
//   cr_approvals     = ผลพิจารณา section 5 (approve.html)
//
// ติดตรงไหนดูเฉลย:  git diff main solution -- backend/src/routes/cr.js

const express = require("express");
const pool = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// ============================================
// GET /api/change-requests — list ทั้งหมด
// ★ เส้นนี้ทำให้ดูเป็นตัวอย่างเต็มๆ — อ่านให้เข้าใจก่อนทำเส้นอื่น
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
// LAB 4A: GET /api/change-requests/:id — CR ตัวเดียว ครบทุกส่วน
// ============================================
// :id = ตัวแปรใน URL เช่นเรียก /api/change-requests/7
// ค่า 7 จะโผล่ใน req.params.id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const crId = req.params.id;

    const [[cr]] = await pool.query(
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

    const [types] = await pool.query(
      "SELECT change_type FROM cr_change_types WHERE cr_id = ?",
      [crId]
    );
    const [plans] = await pool.query(
      "SELECT step, start_date, end_date, owner, note FROM cr_action_plans WHERE cr_id = ? ORDER BY seq_no",
      [crId]
    );
    const [approvals] = await pool.query(
      `SELECT a.result, a.comment, a.approval_date, u.full_name AS approver
       FROM cr_approvals a
       JOIN users u ON u.user_id = a.approver_id
       WHERE a.cr_id = ?`,
      [crId]
    );

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
// LAB 4B: POST /api/change-requests — บันทึก CR ใหม่ (โจทย์พีคสุด)
// ============================================
// body ที่ frontend/js/form.js จะส่งมา:
// { crNumber, requestDate, department, systemCode, contact, priority,
//   subject, problem, requestDetail, impact, impactDetail, downtime,
//   duration, deployDate, changeTypes: [], plan: [], status }
//
// ★ concept ใหม่: transaction
// งานนี้ต้อง INSERT 3 ตาราง (CR + ประเภท + แผนงาน)
// ถ้าตารางแรกสำเร็จแล้วตารางถัดไปพัง = ข้อมูลค้างครึ่งๆ กลางๆ
// transaction = "ทำทั้งหมด หรือไม่ทำเลยสักอย่าง":
//   conn.beginTransaction()  เริ่มจดแบบร่าง
//   conn.commit()            พอใจแล้ว บันทึกจริงทั้งหมด
//   conn.rollback()          พังกลางทาง ยกเลิกแบบร่างทั้งหมด
// transaction ต้องอยู่บน connection เส้นเดียวกันตลอด
// เลยต้องจองจากสระ: const conn = await pool.getConnection()
// (แล้วใช้ conn.query แทน pool.query ทุกที่ในเส้นนี้)
router.post("/", requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const b = req.body;

    if (!b.crNumber || !b.subject || !b.systemCode) {
      return res.status(400).json({ error: "ต้องมี crNumber, subject, systemCode" });
    }

    const [systemRows] = await conn.query(
      "SELECT system_id FROM systems WHERE system_code = ?",
      [b.systemCode]
    );
    if (!systemRows[0]) {
      return res.status(400).json({ error: "Unknown systemCode" });
    }
    const systemId = systemRows[0].system_id;

    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO change_requests
        (cr_number, request_date, requester_id, department, system_id, contact,
         priority, subject, problem, request_detail, impact, impact_detail,
         downtime, duration, deploy_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.crNumber,
        b.requestDate,
        req.user.userId,
        b.department || null,
        systemId,
        b.contact || null,
        b.priority || "Low",
        b.subject,
        b.problem || null,
        b.requestDetail || null,
        b.impact || "none",
        b.impactDetail || null,
        b.downtime ? 1 : 0,
        b.duration || null,
        b.deployDate || null,
        b.status === "draft" ? "draft" : "submitted"
      ]
    );
    const crId = result.insertId;   // เลขที่ IDENTITY เพิ่งแจก

    for (const type of b.changeTypes || []) {
      await conn.query(
        "INSERT INTO cr_change_types (cr_id, change_type) VALUES (?, ?)",
        [crId, type]
      );
    }

    let seq = 1;
    for (const row of b.plan || []) {
      await conn.query(
        `INSERT INTO cr_action_plans (cr_id, seq_no, step, start_date, end_date, owner, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crId, seq++, row.step, row.start, row.end, row.owner || null, row.note || null]
      );
    }

    await conn.commit();
    res.status(201).json({ crId, crNumber: b.crNumber });
  } catch (err) {
    await conn.rollback();   // ยกเลิกทุก INSERT ใน transaction
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
// LAB 4C: POST /api/change-requests/:id/approval — บันทึกผลพิจารณา
// ============================================
// สังเกตด่าน 2 ชั้น: requireAuth แล้วต่อด้วย requireRole
// role requester หลุดมาถึงนี่จะโดน 403 เด้งกลับ (ฝีมือ LAB 3.4)
// body: { result: "approved"|"rejected"|"more-info", comment, approvalDate }
router.post("/:id/approval", requireAuth, requireRole("approver", "it_admin"),
  async (req, res, next) => {
    // เส้นนี้แตะ 2 ตาราง (เพิ่มผลพิจารณา + อัปเดตสถานะใบ CR)
    // เลยใช้ transaction เหมือน LAB 4B
    const conn = await pool.getConnection();
    try {
      const crId = req.params.id;
      const { result, comment, approvalDate } = req.body;

      if (!["approved", "rejected", "more-info"].includes(result)) {
        return res.status(400).json({ error: "result ต้องเป็น approved/rejected/more-info" });
      }

      const [crRows] = await conn.query(
        "SELECT cr_id FROM change_requests WHERE cr_id = ?",
        [crId]
      );
      if (!crRows[0]) {
        return res.status(404).json({ error: "CR not found" });
      }

      await conn.beginTransaction();

      await conn.query(
        `INSERT INTO cr_approvals (cr_id, approver_id, result, comment, approval_date)
         VALUES (?, ?, ?, ?, ?)`,
        [crId, req.user.userId, result, comment || null, approvalDate]
      );

      // enum ใน schema ใช้ขีดล่าง แต่หน้าเว็บส่งขีดกลางมา (more-info -> more_info)
      const statusValue = result === "more-info" ? "more_info" : result;
      await conn.query(
        "UPDATE change_requests SET status = ?, updated_at = GETDATE() WHERE cr_id = ?",
        [statusValue, crId]
      );

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

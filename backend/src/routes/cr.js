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

    // TODO(LAB 4A.1): query ใบ CR หลักจาก change_requests (WHERE cr_id = ?)
    //   JOIN users กับ systems เอาชื่อมาด้วย (ก็อปท่าจาก GET / ข้างบนได้เลย)
    // hint รับผลแบบแถวเดียว: const [[cr]] = await pool.query(...)
    //   (วงเล็บซ้อน 2 ชั้น = หยิบแถวแรกเลย)

    // TODO(LAB 4A.2): ไม่เจอ (cr เป็น undefined) -> ตอบ 404

    // TODO(LAB 4A.3): CR 1 ใบกระจายอยู่ 4 ตาราง — query อีก 3 ก้อน:
    //   - cr_change_types  WHERE cr_id = ?
    //   - cr_action_plans  WHERE cr_id = ?  ORDER BY seq_no
    //   - cr_approvals     WHERE cr_id = ?  (JOIN users เอาชื่อผู้อนุมัติ)

    // TODO(LAB 4A.4): ประกอบร่างตอบกลับก้อนเดียว
    // hint:
    //   res.json({
    //     ...cr,                                        // แผ่ทุก field ออกมา
    //     changeTypes: types.map(t => t.change_type),   // [{...}] -> ["App",...]
    //     plan: plans,
    //     approvals
    //   });

    res.status(501).json({ error: "Not implemented yet — ทำ LAB 4A ก่อน" });
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

    // TODO(LAB 4B.1): เช็คของที่ขาดไม่ได้ — crNumber, subject, systemCode
    //   ขาด -> ตอบ 400

    // TODO(LAB 4B.2): แปลง systemCode ("web-portal") เป็น system_id (ตัวเลข)
    //   query ตาราง systems — ไม่เจอ -> ตอบ 400 "Unknown systemCode"

    // TODO(LAB 4B.3): await conn.beginTransaction();

    // TODO(LAB 4B.4): INSERT ตาราง change_requests (ใบ CR หลัก)
    //   จุดสำคัญ:
    //   - requester_id เอาจาก req.user.userId (จาก token)
    //     ห้ามเชื่อค่าจาก body — ปลอมง่าย
    //   - ช่องที่ไม่ได้กรอกเก็บ null: b.department || null
    //   - downtime: MySQL ไม่มี true/false -> b.downtime ? 1 : 0
    //   - status: b.status === "draft" ? "draft" : "submitted"
    // hint เอา id แถวใหม่: const [result] = await conn.query("INSERT ...");
    //   const crId = result.insertId;   // เลขที่ AUTO_INCREMENT เพิ่งแจก

    // TODO(LAB 4B.5): วน loop INSERT cr_change_types ทีละค่า
    // hint: for (const type of b.changeTypes || []) { ... }
    //   (|| [] เผื่อไม่ติ๊กเลย — วนศูนย์รอบ ไม่พัง)

    // TODO(LAB 4B.6): วน loop INSERT cr_action_plans ทีละแถว
    //   ใส่ seq_no เป็นลำดับ 1, 2, 3, ...
    // hint: let seq = 1; แล้วใช้ seq++ (ใช้ค่าแล้วค่อยบวก)

    // TODO(LAB 4B.7): await conn.commit();
    //   แล้วตอบ 201 พร้อม { crId, crNumber }
    //   (201 = สร้างของใหม่สำเร็จ / frontend เอา crId ไปเปิดหน้า approve ต่อ)

    res.status(501).json({ error: "Not implemented yet — ทำ LAB 4B ก่อน" });
  } catch (err) {
    // TODO(LAB 4B.8): await conn.rollback();  ← ยกเลิกทุก INSERT ใน transaction
    //   แถม: ถ้า err.code === "ER_DUP_ENTRY" (เลข CR ซ้ำ เพราะ cr_number UNIQUE)
    //   ตอบ 409 "CR number already exists" แทน
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

      // TODO(LAB 4C.1): กันค่ามั่ว — result ต้องเป็น 1 ใน 3:
      //   "approved" / "rejected" / "more-info"  ไม่ใช่ -> 400
      // hint: ["approved", "rejected", "more-info"].includes(result)

      // TODO(LAB 4C.2): เช็คว่าใบ CR นี้มีจริง — ไม่มี -> 404

      // TODO(LAB 4C.3): เริ่ม transaction แล้วทำ 2 อย่าง:
      //   1. INSERT cr_approvals (คนอนุมัติ = req.user.userId จาก token)
      //   2. UPDATE change_requests SET status = ? WHERE cr_id = ?
      //      ระวัง: "more-info" ต้องแปลงเป็น "more_info"
      //      (enum ใน schema ใช้ขีดล่าง แต่หน้าเว็บส่งขีดกลางมา)

      // TODO(LAB 4C.4): commit แล้วตอบ 201 { ok: true }

      res.status(501).json({ error: "Not implemented yet — ทำ LAB 4C ก่อน" });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  });

module.exports = router;

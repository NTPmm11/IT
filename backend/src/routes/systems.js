// ============================================
// routes/systems.js — GET /api/systems (dropdown ในฟอร์ม)
// ============================================
//
// ★ LAB 1 — โจทย์แรก ง่ายสุด: query ตารางเดียว ไม่มีเงื่อนไขซับซ้อน
//
// เป้าหมาย: ส่งรายชื่อระบบจากตาราง systems ให้หน้าฟอร์ม
// เอาไปวาดเป็นตัวเลือกใน dropdown "ระบบที่เกี่ยวข้อง"
// (frontend/js/form.js เรียกเส้นนี้ตอนหน้าเปิด)
//
// ทำเสร็จแล้วเช็คยังไง:
// 1. npm run dev แล้วเปิด http://localhost:4000/api/systems ใน browser
//    ต้องเห็น JSON array 3 ระบบจาก schema.sql
// 2. เปิดหน้าฟอร์ม dropdown ต้องมีตัวเลือกโผล่
//
// ติดตรงไหนดูเฉลย:  git diff main solution -- backend/src/routes/systems.js

const express = require("express");
const pool = require("../db");   // ตัวคุยกับ MySQL — ใช้ผ่าน pool.query(...)

const router = express.Router();

// "/" ในไฟล์นี้ = URL จริงคือ /api/systems
// (index.js เสียบไฟล์นี้ไว้ใต้ /api/systems)
router.get("/", async (req, res, next) => {
  try {
    // TODO(LAB 1.1): query ตาราง systems
    //   - เอา 2 column: system_code, system_name
    //   - เอาเฉพาะแถวที่ is_active = 1
    //   - เรียงตาม system_name
    //
    // hint: ผลของ pool.query ต้องรับแบบนี้ (วงเล็บเหลี่ยมสำคัญ):
    //   const [rows] = await pool.query("SELECT ...");

    // TODO(LAB 1.2): ตอบ rows กลับเป็น JSON ด้วย res.json(...)
    // เสร็จแล้วลบบรรทัด placeholder ข้างล่างทิ้ง
    res.status(501).json({ error: "Not implemented yet — ทำ LAB 1 ก่อน" });
  } catch (err) {
    // database พัง -> ส่งต่อให้ error handler กลางใน index.js
    next(err);
  }
});

module.exports = router;

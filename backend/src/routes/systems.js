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
const dbPool = require("../db");   // ตัวคุยกับ SQL Server — ใช้ผ่าน dbPool.query(...)

const router = express.Router();

// "/" ในไฟล์นี้ = URL จริงคือ /api/systems
// (index.js เสียบไฟล์นี้ไว้ใต้ /api/systems)
router.get("/", async (req, res, next) => {
  try {
    // ไม่มีเงื่อนไขจาก user เลยไม่ต้องมี "?" placeholder เหมือนไฟล์อื่น
    // is_active = 1 = กรองเอาเฉพาะระบบที่ยังเปิดใช้งาน (ไม่โชว์ระบบที่ปิดไปแล้ว)
    // dbPool.query คืน [systemRows, fields] — สนใจแค่ systemRows เลยดึงตัวแรกออกมาด้วย [systemRows]
    const [systemRows] = await dbPool.query(
      "SELECT system_code, system_name FROM systems WHERE is_active = 1 ORDER BY system_name"
    );

    // res.json(systemRows) = ส่ง systemRows กลับเป็น JSON array ตรงๆ ให้ frontend เอาไปวาด dropdown
    res.json(systemRows);
  } catch (err) {
    // database พัง -> ส่งต่อให้ error handler กลางใน index.js
    next(err);
  }
});

module.exports = router;

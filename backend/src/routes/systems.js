// ============================================
// routes/systems.js — GET /api/systems (dropdown ในฟอร์ม)
// ============================================
//
// route ที่สั้นสุดในโปรเจค — เหมาะเอาไว้ดูเป็นแบบตอนจะเพิ่ม API ใหม่
//
// หน้าที่: ส่งรายชื่อระบบจากตาราง systems ให้หน้าฟอร์ม
// เอาไปวาดเป็นตัวเลือกใน dropdown "ระบบที่เกี่ยวข้อง"
// (form.js เรียกตอนหน้าเปิด ใน mounted)
//
// อยากเพิ่มตัวเลือกใน dropdown -> INSERT แถวใหม่ในตาราง systems
// ไม่ต้องแตะโค้ดเลยสักบรรทัด

const express = require("express");
const pool = require("../db");

const router = express.Router();

// "/" ในไฟล์นี้ = URL จริงคือ /api/systems
// (index.js เสียบไฟล์นี้ไว้ใต้ /api/systems)
//
// เส้นนี้ไม่ใส่ requireAuth — ยอมให้เรียกได้โดยไม่ต้อง login
// เพราะรายชื่อระบบไม่ใช่ข้อมูลลับ
router.get("/", async (req, res, next) => {
  try {
    // ผลจาก pool.query เป็น array ซ้อน: [แถวข้อมูล, ข้อมูลเทคนิคของ column]
    // const [rows] = ... คือหยิบเฉพาะก้อนแรก (แถวข้อมูล) มาใช้
    const [rows] = await pool.query(
      "SELECT system_code, system_name FROM systems WHERE is_active = 1 ORDER BY system_name");

    // ตอบเป็น JSON array เช่น
    // [{ system_code: "sap", system_name: "SAP / ERP System" }, ...]
    res.json(rows);
  } catch (err) {
    // database พัง -> ส่งต่อให้ error handler กลางใน index.js
    next(err);
  }
});

module.exports = router;

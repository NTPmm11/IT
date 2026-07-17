// ============================================
// routes/auth.js — POST /api/auth/login
// ============================================
//
// เส้นทางของการ login (ไล่จาก frontend มา):
// 1. หน้าเว็บ (frontend/js/login.js) ส่ง username/password มา
// 2. ไฟล์นี้ค้น user ในตาราง users
// 3. เทียบรหัสผ่านกับ hash ใน database
// 4. ถูก -> แจก token (บัตรผ่าน) กลับไป / ผิด -> ตอบ 401

const express = require("express");
const bcrypt = require("bcryptjs");     // ตัวเทียบรหัสผ่านกับ hash
const jwt = require("jsonwebtoken");    // ตัวสร้าง token (บัตรผ่าน)
const pool = require("../db");          // ตัวคุยกับ MySQL (../ = ถอยขึ้น 1 โฟลเดอร์)

// Router = "app จิ๋ว" เขียน route แยกไฟล์ได้
// เดี๋ยว index.js เอาไปเสียบใต้ /api/auth อีกที
// เพราะงั้น "/login" ในไฟล์นี้ = URL จริงคือ /api/auth/login
const router = express.Router();

// POST /api/auth/login  body: { username, password }
// async = ใน function นี้มีจังหวะต้อง "รอ" (รอ database ตอบ)
router.post("/login", async (req, res, next) => {
  try {
    // req.body = ข้อมูล JSON ที่ frontend ส่งมา
    // (express.json() ใน index.js แปลงให้เป็น object แล้ว)
    // เขียนแบบนี้ = แกะ 2 ค่าออกมาเป็นตัวแปรเลย
    const { username, password } = req.body;

    // เช็คของครบก่อนถึงค่อยไปคุย database
    // 400 = "request ผิดรูปแบบ" (ความผิดฝั่งคนส่ง)
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    // ค้น user ในตาราง users
    // เครื่องหมาย ? = ช่องเสียบค่า mysql2 จะใส่ค่าจาก array ให้เอง
    // ห้ามเอาค่าไปต่อ string ใน SQL ตรงๆ เด็ดขาด — โดน SQL injection
    // (คนพิมพ์โค้ด SQL ใส่ช่อง username แล้วยึด database เราได้)
    // await = หยุดรอตรงนี้จน database ตอบ ค่อยไปบรรทัดถัดไป
    const [rows] = await pool.query(
      "SELECT user_id, username, password_hash, full_name, department, role FROM users WHERE username = ? AND is_active = 1",
      [username]
    );

    // query คืน array เสมอ — เจอ 1 คนก็ได้ array 1 ตัว, ไม่เจอได้ array ว่าง
    // rows[0] = คนแรก (undefined ถ้าไม่เจอ)
    const user = rows[0];

    // bcrypt.compare = เอารหัสที่พิมพ์มา hash แล้วเทียบกับ hash ใน DB
    // (hash ย้อนกลับเป็นรหัสเดิมไม่ได้ เลยต้องเทียบท่านี้แทน)
    //
    // จุดสังเกต: user ไม่มี กับ รหัสผิด ตอบ error "เดียวกัน" จงใจนะ
    // ถ้าแยกตอบ "ไม่มี user นี้" คนร้ายจะไล่เดาได้ว่า username ไหนมีจริง
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // ถึงตรงนี้ = login ถูกต้อง สร้างบัตรผ่าน (token) แจก
    // jwt.sign(ข้อมูลที่ฝังในบัตร, กุญแจเซ็น, ตัวเลือก)
    const token = jwt.sign(
      // ข้อมูลที่ฝังในบัตร — middleware/auth.js จะแกะออกมาใช้ทีหลัง
      // ฝังแค่ที่จำเป็น อย่าฝังของลับ (คนถือบัตรแกะอ่านได้ แค่แก้ไม่ได้)
      { userId: user.user_id, username: user.username, role: user.role },
      // กุญแจลับจาก .env — ใครไม่มีกุญแจนี้ ปลอมบัตรไม่ได้
      process.env.JWT_SECRET,
      // บัตรหมดอายุใน 8 ชม. หลังจากนั้นต้อง login ใหม่
      { expiresIn: "8h" }
    );

    // ตอบกลับ frontend: บัตรผ่าน + ข้อมูล user ไว้โชว์บนหน้าเว็บ
    // (login.js เอาไปเก็บใน localStorage)
    res.json({
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        department: user.department,
        role: user.role
      }
    });
  } catch (err) {
    // มีอะไรพังกลางทาง (เช่น database ล่ม)
    // next(err) = โยนให้ error handler กลางใน index.js จัดการ
    next(err);
  }
});

module.exports = router;

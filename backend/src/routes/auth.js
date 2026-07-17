// ============================================
// routes/auth.js — POST /api/auth/login
// ============================================
//
// ★ LAB 2 — ระบบ login ของจริง (เช็คกับ database)
//
// เส้นทางของการ login:
// 1. หน้าเว็บ (frontend/js/login.js) ส่ง username/password มา
// 2. ค้น user ในตาราง users
// 3. เทียบรหัสผ่านกับ hash ใน database
// 4. ถูก -> ตอบข้อมูล user กลับไป / ผิด -> ตอบ 401
//    (หน้าเว็บเก็บข้อมูล user ไว้ แล้วใช้แนบ X-User-Id ทุก request หลังจากนี้)
//
// ทำเสร็จแล้วเช็คยังไง (ยังไม่ต้องแก้ frontend ก็เทสได้):
//   curl -X POST http://localhost:4000/api/auth/login \
//     -H "Content-Type: application/json" \
//     -d '{"username":"admin","password":"1234"}'
//   รหัสถูกต้องได้ข้อมูล user กลับมา / รหัสผิดได้ 401
//
// ติดตรงไหนดูเฉลย:  git diff main solution -- backend/src/routes/auth.js

const express = require("express");
const bcrypt = require("bcryptjs");     // ตัวเทียบรหัสผ่านกับ hash
const pool = require("../db");

const router = express.Router();

// POST /api/auth/login  body: { username, password }
router.post("/login", async (req, res, next) => {
  try {
    // TODO(LAB 2.1): แกะ username กับ password ออกจาก req.body
    // hint: const { username, password } = req.body;

    // TODO(LAB 2.2): ถ้าขาดตัวใดตัวหนึ่ง ตอบ 400 พร้อมข้อความ error
    // hint: return res.status(400).json({ error: "..." });
    // (อย่าลืม return — ไม่งั้นโค้ดข้างล่างทำงานต่อ)

    // TODO(LAB 2.3): ค้น user ในตาราง users
    //   - WHERE username ตรงกัน และ is_active = 1
    //   - ใช้ ? เป็นช่องเสียบค่า ห้ามต่อ string เด็ดขาด (SQL injection!)
    // hint:
    //   const [rows] = await pool.query(
    //     "SELECT user_id, username, password_hash, full_name, department, role FROM users WHERE username = ? AND is_active = 1",
    //     [username]);
    //   const user = rows[0];   // undefined ถ้าไม่เจอ

    // TODO(LAB 2.4): เช็ครหัสผ่าน
    //   - bcrypt.compare(รหัสที่พิมพ์มา, user.password_hash) ได้ true/false
    //   - user ไม่มี "หรือ" รหัสผิด -> ตอบ 401 ข้อความเดียวกันทั้งคู่
    //     (จงใจไม่แยก — กัน attacker ไล่เดาว่า username ไหนมีจริง)
    // hint: if (!user || !(await bcrypt.compare(password, user.password_hash)))

    // TODO(LAB 2.5): login ถูกต้อง — ตอบข้อมูล user กลับไป
    //   (frontend เก็บลง localStorage แล้วใช้ userId แนบทุก request ต่อจากนี้)
    // hint:
    //   res.json({
    //     user: {
    //       userId: user.user_id,
    //       username: user.username,
    //       fullName: user.full_name,
    //       department: user.department,
    //       role: user.role
    //     }
    //   });

    // เสร็จแล้วลบ placeholder นี้ทิ้ง
    res.status(501).json({ error: "Not implemented yet — ทำ LAB 2 ก่อน" });
  } catch (err) {
    // มีอะไรพังกลางทาง -> โยนให้ error handler กลางใน index.js
    next(err);
  }
});

module.exports = router;

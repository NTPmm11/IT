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
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "ต้องกรอก username และ password" });
    }

    const [rows] = await pool.query(
      "SELECT user_id, username, password_hash, full_name, department, role FROM users WHERE username = ? AND is_active = 1",
      [username]
    );
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Username หรือ password ไม่ถูกต้อง" });
    }

    res.json({
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        department: user.department,
        role: user.role
      }
    });
  } catch (err) {
    // มีอะไรพังกลางทาง -> โยนให้ error handler กลางใน index.js
    next(err);
  }
});

module.exports = router;

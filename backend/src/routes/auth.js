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
//
// ── วิธีเขียนทีละขั้น (ถ้าเริ่มจากไฟล์เปล่า) ──
// 1. import ของที่ต้องใช้: express (สร้าง router), bcryptjs (เทียบรหัสผ่าน), dbPool (คุย database)
// 2. สร้าง router ด้วย express.Router() — ไฟล์นี้จัดการเฉพาะ route ใต้ /auth
// 3. ประกาศ route: router.post("path", async handler) — path ตั้งเป็น "/login" เฉยๆ
//    (ไม่ต้องใส่ "/api/auth" ซ้ำ เพราะ index.js เป็นคนเสียบ prefix ให้ตอน app.use)
// 4. handler เขียนเป็น async (req, res, next) => {...} เพราะข้างในต้อง await database
// 5. ครอบทั้งฟังก์ชันด้วย try/catch — catch แล้วเรียก next(err) โยนต่อให้ error handler กลาง
//    (ไม่ใช่ปล่อยให้ error หลุดออกมาทำ server ล่ม)
// 6. ในนั้นเขียนตามลำดับ "คิดเป็นขั้นตอนธรรมดา" ก่อนแล้วค่อยแปลงเป็นโค้ด:
//    a. ดึง username/password จาก req.body -> ไม่ครบตอบ 400 แล้ว return ออกทันที
//    b. SELECT user จาก username ใน database
//    c. เทียบ password ที่กรอก กับ hash ที่เก็บไว้ (bcrypt.compare) -> ไม่ตรงตอบ 401 แล้ว return
//    d. ผ่านทุกด่าน -> res.json(...) ส่งข้อมูล user (ห้ามส่ง password_hash กลับ)
// 7. ท้ายไฟล์ module.exports = router — เพื่อให้ index.js เอาไป app.use("/api/auth", router) ได้
//
// หลักคิดที่ใช้ซ้ำได้กับทุก route ในโปรเจกต์นี้: "validate ก่อน -> query -> ตัดสินใจตอบอะไร -> ตอบ"
// ผิดจุดไหนก็ return ออกจากจุดนั้นทันที (early return) ไม่ปล่อยให้โค้ดไหลต่อไปเงื่อนไขถัดไป

const express = require("express");
const bcrypt = require("bcryptjs");     // ตัวเทียบรหัสผ่านกับ hash
const dbPool = require("../db");

const router = express.Router();

// router.post("/login", ...) = ผูก handler นี้กับ "POST /login"
// ของไฟล์นี้ (index.js เสียบไว้ใต้ /api/auth เลยรวมเป็น POST /api/auth/login)
//
// body: { username, password }  <- ข้อมูลที่ frontend ส่งมาใน request body (JSON)
router.post("/login", async (req, res, next) => {
  try {
    // { username, password } = req.body คือ "destructuring"
    // เทียบเท่ากับเขียนยาวๆ ว่า:
    //   const username = req.body.username;
    //   const password = req.body.password;
    const { username, password } = req.body;

    // ไม่กรอกมาสักช่อง -> 400 Bad Request (ฝั่ง client ส่งข้อมูลมาไม่ครบ/ผิด)
    if (!username || !password) {
      return res.status(400).json({ error: "ต้องกรอก username และ password" });
    }

    // หา user จาก username ในตาราง users (is_active = 1 = ยังไม่ถูกปิดใช้งาน)
    // dbPool.query คืน [userRows, fields] เอาแค่ userRows แถวแรก (ถ้ามี) คือ user ที่เจอ
    const [userRows] = await dbPool.query(
      "SELECT user_id, username, password_hash, full_name, department, role FROM users WHERE username = ? AND is_active = 1",
      [username]
    );
    const user = userRows[0];

    // database ไม่เก็บรหัสผ่านตรงๆ เก็บเป็น hash (เข้ารหัสทางเดียว ถอดกลับไม่ได้)
    // bcrypt.compare(รหัสที่กรอก, hash ใน database) = true/false ว่าตรงกันไหม
    // !user ต้องเช็คก่อน (short-circuit) เพราะถ้าไม่เจอ user ก็ไม่มี password_hash ให้เทียบ
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      // 401 Unauthorized — ไม่บอกด้วยว่า "username ผิด" หรือ "password ผิด"
      // กันคนร้ายเดา username ที่มีจริงในระบบจากข้อความ error
      return res.status(401).json({ error: "Username หรือ password ไม่ถูกต้อง" });
    }

    // login ผ่าน -> ตอบข้อมูล user กลับไป (ไม่ส่ง password_hash กลับเด็ดขาด)
    // frontend จะเก็บก้อนนี้ไว้ใน localStorage แล้วใช้แนบ X-User-Id ทุก request หลังจากนี้
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

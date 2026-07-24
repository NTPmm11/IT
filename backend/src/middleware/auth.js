// ============================================
// middleware/auth.js — ด่านเช็คว่าใครยิง request มา
// ============================================
//
// ★ LAB 3 — สร้างด่านตรวจ (ต้องผ่าน LAB 2 มาก่อน ถึงจะ login ได้)
//
// middleware = function ที่ยืนขวาง"ก่อนถึง" route จริง
// ลำดับการเดินของ request:
//
//   request -> requireAuth (เป็น user ไหน?) -> requireRole (สิทธิ์ถึงไหม?) -> route จริง
//
// วิธีบอกตัวตนของโปรเจคนี้ (แบบง่ายสำหรับหัดเขียน):
// หลัง login สำเร็จ หน้าเว็บจะแนบ "ป้ายชื่อ" มากับทุก request
// เป็น header ชื่อ X-User-Id = เลข user_id ของคนที่ login
// (apiFetch ใน frontend/js/config.js แนบให้อัตโนมัติอยู่แล้ว)
//
// ⚠ ซื่อสัตย์กันไว้ก่อน: วิธีนี้ใครก็ปลอม header ได้ ไม่ปลอดภัยจริง
// งานจริงใช้ token/session ที่ปลอมไม่ได้ — เก็บไว้เรียนขั้นถัดไป
// ตอนนี้เอา "แนวคิด middleware" ให้แน่นก่อนพอ
//
// ทำเสร็จแล้วเช็คยังไง:
//   ยิง GET http://localhost:4000/api/change-requests แบบไม่แนบ header
//   ต้องได้ 401 / แนบ -H "X-User-Id: 1" ต้องผ่าน
//
// ติดตรงไหนดูเฉลย:  git diff main solution -- backend/src/middleware/auth.js

const dbPool = require("../db");

// ── ด่าน 1: requireAuth = ดูป้ายชื่อ แล้วเช็คว่า user นี้มีจริงใน database ──
// (async เพราะข้างในต้องรอ database ตอบ)
// พารามิเตอร์ (req, res, next) คือหน้าตามาตรฐานของ middleware ใน Express:
//   req  = ข้อมูลขาเข้า (header, body, query, params)
//   res  = ใช้ตอบกลับ (res.status(...).json(...))
//   next = ฟังก์ชัน "ไปต่อ" — เรียกเฉยๆ = ผ่านด่าน / เรียก next(err) = โยน error ไปให้ error handler กลาง
async function requireAuth(req, res, next) {
  try {
    // req.headers เก็บ header ทั้งหมด ชื่อ header จะถูกแปลงเป็นตัวเล็กเสมอ
    // เลยต้องเขียน "x-user-id" ตัวเล็ก แม้ frontend จะส่งมาเป็น "X-User-Id"
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({ error: "Missing X-User-Id header" });
    }

    // "?" ใน query คือ placeholder — เอาค่าจริง (userId) มาแทนแบบปลอดภัย
    // กัน SQL injection (ห้ามเอา userId ไปต่อ string ตรงๆ)
    // dbPool.query คืนค่าเป็น array [userRows, fields] ปกติสนใจแค่ userRows เลยดึงตัวแรกออกมา
    const [userRows] = await dbPool.query(
      "SELECT user_id, username, full_name, role FROM users WHERE user_id = ? AND is_active = 1",
      [userId]
    );
    const user = userRows[0];   // เจอแถวเดียวหรือไม่เจอเลย (undefined ถ้าไม่เจอ)

    if (!user) {
      return res.status(401).json({ error: "Unknown user" });
    }

    // แปะข้อมูล user ไว้ที่ req.user — route ปลายทาง (เช่น cr.js) จะอ่านต่อได้เลย
    // ผ่าน req.user.userId โดยไม่ต้อง query database ซ้ำ
    req.user = { userId: user.user_id, username: user.username, role: user.role };
    next();   // = "ด่านนี้ผ่าน เชิญไปต่อ"
  } catch (err) {
    next(err);
  }
}

// ── ด่าน 2: requireRole = เช็คว่า role ของ user มีสิทธิ์ทำสิ่งนี้ไหม ──
//
// วิธีใช้ (ดูใน routes/cr.js):
//   router.post("/:id/approval", requireAuth, requireRole("approver", "it_admin"), ...)
//   = ต้อง login แล้ว "และ" ต้องเป็น approver หรือ it_admin เท่านั้น
//
// ...roles = รับกี่ค่าก็ได้ รวมเป็น array ให้ เช่น ["approver", "it_admin"]
function requireRole(...roles) {
  // สังเกต: function นี้ "คืน function อีกตัว" ออกไป
  // เพราะ Express ต้องการ middleware หน้าตา (req, res, next)
  // ตัวนอกมีไว้รับรายชื่อ role ตอนตั้งค่า route เฉยๆ
  //
  // ทำไมต้องเป็น requireAuth ก่อนเสมอ: req.user มาจาก requireAuth เท่านั้น
  // ถ้าลืมใส่ requireAuth ก่อน req.user จะเป็น undefined แล้วบรรทัดถัดไปพัง
  return (req, res, next) => {
    // roles มาจากตอนเรียก เช่น requireRole("approver", "it_admin") -> roles = ["approver", "it_admin"]
    // .includes(...) เช็คว่า role ของ user ที่ login อยู่ ตรงกับตัวใดตัวหนึ่งในลิสต์ไหม
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };

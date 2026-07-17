// ============================================
// middleware/auth.js — ด่านเช็ค token ก่อนเข้า route ที่ต้อง login
// ============================================
//
// ★ LAB 3 — สร้างด่านตรวจบัตร (ต้องผ่าน LAB 2 มาก่อน ถึงจะมี token ให้ตรวจ)
//
// middleware = function ที่ยืนขวาง"ก่อนถึง" route จริง
// ลำดับการเดินของ request:
//
//   request -> requireAuth (มีบัตรไหม?) -> requireRole (สิทธิ์ถึงไหม?) -> route จริง
//
// ฝั่ง frontend แนบบัตรมาใน header แบบนี้:
//   Authorization: Bearer <token>
// (apiFetch ใน frontend/js/config.js แนบให้อัตโนมัติอยู่แล้ว)
//
// ทำเสร็จแล้วเช็คยังไง:
//   ยิง GET http://localhost:4000/api/change-requests แบบไม่แนบ token
//   ต้องได้ 401 / แนบ token จาก LAB 2 ต้องผ่าน (ได้ 501 ของ LAB 4 แทน)
//
// ติดตรงไหนดูเฉลย:  git diff main solution -- backend/src/middleware/auth.js

const jwt = require("jsonwebtoken");

// ── ด่าน 1: requireAuth = เช็คว่ามีบัตรผ่าน (token) และบัตรไม่ปลอม ──
function requireAuth(req, res, next) {
  // TODO(LAB 3.1): อ่าน header แล้วแกะ token ออกมา
  //   header หน้าตา: "Bearer eyJhbGciOi..." (คำว่า Bearer + เว้นวรรค + token)
  // hint:
  //   const header = req.headers.authorization || "";
  //   const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  //   (slice(7) = ตัด "Bearer " 7 ตัวอักษรทิ้ง)

  // TODO(LAB 3.2): ไม่มี token -> ตอบ 401 { error: "Missing token" }

  // TODO(LAB 3.3): ตรวจบัตรด้วย jwt.verify(token, process.env.JWT_SECRET)
  //   - ผ่าน -> ได้ข้อมูลที่ฝังไว้คืนมา เก็บใส่ req.user (route ถัดไปใช้ต่อ)
  //     แล้วเรียก next() = "ผ่านด่าน เชิญไปต่อ"
  //   - verify โยน error (บัตรปลอม/หมดอายุ) -> ตอบ 401
  // hint: ครอบด้วย try/catch — verify พังจะ throw ไม่ใช่ return null

  // placeholder: ตอนนี้ปล่อยผ่านทุกคนไปก่อน (ยังไม่ปลอดภัย!)
  // ใส่ user ปลอมไว้ให้ LAB 4 เทสได้ระหว่างที่ LAB นี้ยังไม่เสร็จ
  // เสร็จ LAB 3 แล้วลบ 2 บรรทัดนี้ทิ้ง
  req.user = { userId: 1, username: "admin", role: "it_admin" };
  next();
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
  return (req, res, next) => {
    // TODO(LAB 3.4): เช็คว่า req.user.role อยู่ในรายชื่อ roles ไหม
    //   - ไม่อยู่ -> ตอบ 403 { error: "Forbidden: insufficient role" }
    //     (403 = รู้ว่าเป็นใคร แต่สิทธิ์ไม่ถึง / 401 = ยังไม่ login)
    //   - อยู่ -> next()
    // hint: roles.includes(req.user.role)

    // placeholder: ปล่อยผ่านไปก่อน เสร็จแล้วลบทิ้ง
    next();
  };
}

module.exports = { requireAuth, requireRole };

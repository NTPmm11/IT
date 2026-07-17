// ============================================
// auth.js — ด่านเช็ค token ก่อนเข้า route ที่ต้อง login
// ============================================
//
// middleware = function ที่ยืนขวาง"ก่อนถึง" route จริง
// ลำดับการเดินของ request:
//
//   request -> requireAuth (มีบัตรไหม?) -> requireRole (สิทธิ์ถึงไหม?) -> route จริง
//
// ผ่านทุกด่าน = ได้ทำงานจริง / ตกด่านไหน = โดนตอบ error กลับตรงนั้นเลย
//
// ฝั่ง frontend ต้องแนบบัตรมาใน header แบบนี้:
//   Authorization: Bearer <token>
// (apiFetch ใน frontend/js/config.js แนบให้อัตโนมัติอยู่แล้ว)

const jwt = require("jsonwebtoken");

// ── ด่าน 1: requireAuth = เช็คว่ามีบัตรผ่าน (token) และบัตรไม่ปลอม ──
function requireAuth(req, res, next) {
  // อ่านค่าจาก header ชื่อ authorization
  // หน้าตาที่ควรได้: "Bearer eyJhbGciOi..." (คำว่า Bearer + เว้นวรรค + token)
  const header = req.headers.authorization || "";

  // startsWith เช็คว่าขึ้นต้นถูกแบบไหม / slice(7) = ตัดคำว่า "Bearer " (7 ตัวอักษร) ทิ้ง
  // เหลือแต่ตัว token ล้วนๆ
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  // ไม่มีบัตรมาเลย -> ตอบ 401 (= "ยังไม่ได้ login")
  // return เพื่อจบตรงนี้เลย ไม่ให้โค้ดข้างล่างทำงานต่อ
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    // jwt.verify = ตรวจ 2 อย่างพร้อมกัน:
    // 1. บัตรนี้เซ็นด้วย JWT_SECRET ของเราจริงไหม (กันบัตรปลอม)
    // 2. บัตรหมดอายุหรือยัง (เราตั้งไว้ 8 ชม. ตอนแจกใน routes/auth.js)
    // ผ่าน -> ได้ข้อมูลที่ฝังไว้ในบัตรคืนมา (userId, username, role)
    //
    // แนบข้อมูลนั้นไว้ที่ req.user — route ถัดไปหยิบใช้ได้เลย
    // เช่น cr.js ใช้ req.user.userId เป็นคนบันทึก CR
    req.user = jwt.verify(token, process.env.JWT_SECRET);

    // next() = "ด่านนี้ผ่าน เชิญไปด่านถัดไป"
    next();
  } catch {
    // verify โยน error = บัตรปลอมหรือหมดอายุ -> ตอบ 401 เหมือนกัน
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── ด่าน 2: requireRole = เช็คว่า role ของ user มีสิทธิ์ทำสิ่งนี้ไหม ──
//
// วิธีใช้ (ดูใน routes/cr.js):
//   router.post("/:id/approval", requireAuth, requireRole("approver", "it_admin"), ...)
//   = เส้นนี้ต้อง login แล้ว "และ" ต้องเป็น approver หรือ it_admin เท่านั้น
//
// ...roles = รับกี่ค่าก็ได้ รวมเป็น array ให้ เช่น ["approver", "it_admin"]
function requireRole(...roles) {
  // สังเกต: function นี้ "คืน function อีกตัว" ออกไป
  // เพราะ Express ต้องการ middleware หน้าตา (req, res, next)
  // ตัวนอกมีไว้รับรายชื่อ role ตอนตั้งค่า route เฉยๆ
  return (req, res, next) => {
    // req.user.role มาจากด่าน requireAuth (ต้องผ่านด่านนั้นมาก่อนเสมอ)
    // includes = role ของ user อยู่ในรายชื่อที่อนุญาตไหม
    if (!roles.includes(req.user.role)) {
      // 403 = "รู้ว่าเป็นใคร แต่สิทธิ์ไม่ถึง"
      // (ต่างจาก 401 = "ยังไม่รู้ว่าเป็นใคร / ยังไม่ login")
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

// ส่งออกทั้ง 2 ด่านให้ route อื่นเอาไปคั่นหน้า handler ของตัวเอง
module.exports = { requireAuth, requireRole };

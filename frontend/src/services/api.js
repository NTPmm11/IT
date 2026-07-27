// ============================================
// api.js — ค่ากลาง + ตัวช่วยเรียก API (ใช้ร่วมทุกหน้า)
// ============================================
//
// เดิมคือ js/config.js — ทุกหน้าโหลดไฟล์นี้ก่อนใช้ apiFetch
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง (import ไฟล์นี้ไปใช้ apiFetch): ทุก view/component ที่คุยกับ backend —
//   LoginView, FormView, ListView, ApproveView, ApprovalSection.vue
// ปลายทาง: fetch() ตรงไปที่ backend/src/index.js (API_BASE = http://localhost:4000/api)
//          แล้ว index.js ส่งต่อให้ routes/auth.js, routes/systems.js, routes/cr.js อีกที
// รวม fetch ไว้ไฟล์เดียว เพราะทุกหน้าต้องแนบ X-User-Id และแปลง error เหมือนกันหมด
// ไม่อยากให้แต่ละหน้าเขียน fetch + error handling ซ้ำๆ กัน 6-7 ที่

// ที่อยู่ backend — ถ้า deploy จริงค่อยเปลี่ยนเป็น domain จริง
export const API_BASE = "http://localhost:4000/api";

// apiFetch = fetch ที่แถม 2 อย่างให้อัตโนมัติ:
// 1. แนบ "ป้ายชื่อ" X-User-Id บอก server ว่าเราคือ user ไหน
//    (อ่านจาก user ที่เก็บไว้ใน localStorage ตอน login สำเร็จ)
// 2. ถ้า server ตอบ error โยน Error พร้อมข้อความจาก backend
//
// ⚠ วิธีป้ายชื่อแบบนี้ใช้หัดเขียนเท่านั้น — ใครก็ปลอม header ได้
// งานจริงใช้ token/session ที่ปลอมไม่ได้
export async function apiFetch(path, options = {}) {
  // JSON.parse ต้องการ string เสมอ — ถ้ายังไม่ login (ไม่มี "user")
  // getItem คืน null เลยให้ "null" (string) แทน -> parse ได้ null ออกมา
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      // login แล้วค่อยแนบป้ายชื่อ / ยังไม่ login ไม่แนบ ({} = ไม่เพิ่มอะไร)
      ...(user ? { "X-User-Id": user.userId } : {}),
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

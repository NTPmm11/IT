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
export const API_BASE =
  import.meta.env.VITE_API_BASE ?? "http://localhost:4000/api";

// apiFetch = fetch ที่แถม 3 อย่างให้อัตโนมัติ:
// 1. แนบ token (JWT) บอก server ว่าเราคือใคร — เก็บไว้ตอน login สำเร็จ
// 2. ถ้า server ตอบ error โยน Error พร้อมข้อความจาก backend
// 3. ถ้า token หมดอายุ/ใช้ไม่ได้ (401) ล้าง localStorage แล้วพากลับหน้า login
//
// token ถูกเซ็นด้วย secret ฝั่ง server — แก้ข้างในเองไม่ได้ (ลายเซ็นพัง server ปฏิเสธทันที)
// เดิมใช้แค่ header X-User-Id ซึ่งใครก็พิมพ์เลขอะไรก็เป็นคนนั้นได้
export function getToken() {
  return localStorage.getItem("token");
}

// เรียกตอน logout และตอนโดน 401 — ต้องล้างทั้งคู่เสมอ
// (เหลือ "user" ไว้อย่างเดียว = หน้าเว็บคิดว่ายัง login อยู่ แต่ยิง API ไม่ผ่านสักเส้น)
export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// ตัวยิงจริง — คืนทั้ง response (เอาไว้อ่าน header) และ body ที่แปลงแล้ว
async function request(path, options = {}) {
  const token = getToken();

  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      // login แล้วค่อยแนบ token / ยังไม่ login ไม่แนบ ({} = ไม่เพิ่มอะไร)
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  // 204 No Content (เช่น DELETE) ไม่มี body ให้ parse
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));

  if (res.status === 401) {
    // token หมดอายุระหว่างใช้งาน (default 8 ชม.) หรือ user ถูกปิดใช้งานไปแล้ว
    // location.href แทน router.push เพราะไฟล์นี้ไม่ใช่ component — และการ reload
    // ทั้งหน้าล้าง state ค้างในหน่วยความจำไปด้วยเลย
    clearSession();
    if (window.location.pathname !== "/") window.location.href = "/";
    throw new Error(data?.error || "หมดเวลาใช้งาน กรุณา login ใหม่");
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return { res, data };
}

export async function apiFetch(path, options = {}) {
  const { data } = await request(path, options);
  return data;
}

// เหมือน apiFetch แต่คืนจำนวนแถวทั้งหมดมาด้วย (อ่านจาก header X-Total-Count)
// ใช้กับเส้นที่ตัดหน้าฝั่ง server — หน้าเว็บเอา total ไปคำนวณจำนวนหน้า
// (body ยังเป็น array ของ "เฉพาะหน้านี้" เท่านั้น จะนับ .length เองไม่ได้)
export async function apiFetchPaged(path, options = {}) {
  const { res, data } = await request(path, options);
  const total = res.headers.get("X-Total-Count");
  return { rows: data ?? [], total: total === null ? (data?.length ?? 0) : Number(total) };
}


// ============================================
// config.js — ค่ากลาง + ตัวช่วยเรียก API (ใช้ร่วมทุกหน้า)
// ============================================
//
// ทุกหน้าโหลดไฟล์นี้ "ก่อน" common.js และไฟล์ของหน้านั้น

// ที่อยู่ backend — ถ้า deploy จริงค่อยเปลี่ยนเป็น domain จริง
const API_BASE = "http://localhost:4000/api";

// apiFetch = fetch ที่แถม 2 อย่างให้อัตโนมัติ:
// 1. แนบ token จาก localStorage ใน header (ถ้า login แล้ว)
// 2. ถ้า server ตอบ error โยน Error พร้อมข้อความจาก backend
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

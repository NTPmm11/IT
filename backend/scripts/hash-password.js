// ============================================
// hash-password.js — สร้าง bcrypt hash สำหรับใส่ใน schema.sql
// ============================================
//
// วิธีใช้:  node scripts/hash-password.js 1234
// ได้ hash มาแล้วเอาไปแทน REPLACE_WITH_REAL_HASH ใน database/schema.sql
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ไฟล์นี้ไม่ได้ต่อกับ server เลย — รันมือครั้งเดียวตอนเตรียมข้อมูล ไม่ใช่ส่วนหนึ่งของ app ที่รันอยู่
// ผลลัพธ์ (hash) เอาไปวางในไฟล์ database/users_only.sql (คอลัมน์ password_hash)
// bcrypt เดียวกับที่ routes/auth.js ใช้ bcrypt.compare() ตอน login เทียบ hash นี้กลับ

const bcrypt = require("bcryptjs");

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.js <password>");
  process.exit(1);
}

console.log(bcrypt.hashSync(password, 10));

// ============================================
// hash-password.js — สร้าง bcrypt hash สำหรับใส่ใน schema.sql
// ============================================
//
// วิธีใช้:  node scripts/hash-password.js 1234
// ได้ hash มาแล้วเอาไปแทน REPLACE_WITH_REAL_HASH ใน database/schema.sql

const bcrypt = require("bcryptjs");

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.js <password>");
  process.exit(1);
}

console.log(bcrypt.hashSync(password, 10));

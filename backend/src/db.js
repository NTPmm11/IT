// ============================================
// db.js — ตัวเชื่อมต่อกับ MySQL (mysql2/promise)
// ============================================
//
// 📌 หมายเหตุการปรับเปลี่ยนจาก SQL Server เป็น MySQL:
// จากตอนแรกไฟล์นี้มีโค้ด 170+ บรรทัดเพราะต้องเขียนฟังก์ชันจำลอง (wrap) ตัว SQL Server (mssql)
// ให้ทำงานเลียนแบบ mysql2 (แปลง ?, SCOPE_IDENTITY(), bindParams ฯลฯ)
//
// พอเปลี่ยนมาใช้ MySQL จริงผ่านไลบรารี `mysql2/promise`:
// 1. mysql2 มีตัวจัดการ Connection Pool, query (รองรับ ?), และ Transaction
//    (beginTransaction, commit, rollback, release) สำเร็จรูปในตัวอยู่แล้ว
// 2. จึงไม่จำเป็นต้องเขียนฟังก์ชันครอบ (wrapper) เองอีกต่อไป
// 3. ทุก route (auth.js, cr.js, systems.js) สามารถใช้ dbPool.query()
//    และ dbPool.getConnection() ได้เหมือนเดิมเป๊ะ 100%

require("dotenv").config();
const mysql = require("mysql2/promise");

// สร้าง Connection Pool สำหรับต่อกับ MySQL Database
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "CR",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;

// ============================================
// db.js — ตัวต่อกับ MySQL (ใช้ร่วมทุก route)
// ============================================
//
// ปัญหาที่ไฟล์นี้แก้: ทุก route ต้องคุยกับ database
// ถ้าเปิด connection ใหม่ทุกครั้งที่มี request = ช้ามาก
//
// ทางแก้ = pool (สระว่ายน้ำของ connection):
// เปิด connection ค้างไว้ล่วงหน้าหลายเส้น ใครจะใช้ก็หยิบไป
// ใช้เสร็จคืนสระ ไม่ต้องเปิด/ปิดใหม่ทุกรอบ

// อ่านไฟล์ .env ก่อน — รหัส database อยู่ในนั้น
require("dotenv").config();

// mysql2/promise = library คุยกับ MySQL เวอร์ชันที่รองรับ async/await
// (ทำให้เขียน await pool.query(...) ได้ อ่านง่ายกว่าแบบ callback เยอะ)
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  // ค่าทั้งหมดอ่านจาก .env — ถ้าไม่มีใช้ค่าหลัง || แทน
  // แยกไว้ใน .env เพราะรหัสของแต่ละเครื่องไม่เหมือนกัน
  // และห้าม commit รหัสขึ้น git เด็ดขาด
  host: process.env.DB_HOST || "localhost",   // database อยู่เครื่องไหน
  port: Number(process.env.DB_PORT) || 3306,  // MySQL ฟังที่ port นี้
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "it_change_request",  // ชื่อ DB จาก schema.sql

  waitForConnections: true,  // สระเต็ม -> ต่อคิวรอ (ไม่โยน error ทันที)
  connectionLimit: 10,       // เปิดค้างสูงสุด 10 เส้น พอสำหรับโปรเจคเรา
  charset: "utf8mb4_unicode_ci"  // รองรับภาษาไทย (ตรงกับที่ตั้งใน schema.sql)
});

// ส่งออกให้ไฟล์อื่น require ไปใช้ — ทุก route ใช้ pool ตัวเดียวกันนี้
module.exports = pool;

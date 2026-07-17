// ============================================
// index.js — จุดเริ่มของ backend (Express app)
// ============================================
//
// ไฟล์นี้คือ "ประตูหน้า" ของหลังบ้านทั้งหมด
// หน้าที่: สร้าง server ขึ้นมา 1 ตัว แล้วบอกว่า
// URL ไหนให้ส่งต่อไปที่ route ไฟล์ไหน
//
// รัน: npm run dev  (ต้องมีไฟล์ .env ก่อน — copy จาก .env.example)
// API ทั้งหมดอยู่ใต้ /api/*  frontend ยิงมาที่ http://localhost:4000

// dotenv = ตัวอ่านไฟล์ .env แล้วยัดค่าเข้า process.env
// ต้องเรียกบรรทัดแรกสุด ก่อน require ไฟล์อื่น
// เพราะ db.js กับ auth ต้องใช้ค่าจาก .env ตอนโหลด
require("dotenv").config();

// require = ดึงของจากกล่องอื่นมาใช้ (เหมือน <script src> ฝั่งหน้าเว็บ)
const express = require("express");  // ตัวสร้าง server
const cors = require("cors");        // ตัวปลดล็อกให้คนละ port คุยกันได้

// ดึง route ของเราเอง (./ = ไฟล์ในโปรเจคเรา ไม่ใช่ของที่ npm install)
const authRoutes = require("./routes/auth");
const systemRoutes = require("./routes/systems");
const crRoutes = require("./routes/cr");

// สร้าง app ขึ้นมา 1 ตัว — ทุกอย่างหลังจากนี้คือการ "ตั้งค่า" app ตัวนี้
const app = express();

// app.use(...) = ติดตั้ง middleware (ด่านที่ทุก request ต้องผ่านตามลำดับ)
//
// ด่าน 1: cors = ยอมให้ frontend (localhost:3000) เรียก API ได้
// ปกติ browser ห้ามเว็บ port นึงยิงหา server อีก port นึง (กัน hack)
// ต้องให้ server ประกาศเองว่า "ฉันยินดีรับ" — cors() ทำหน้าที่นั้น
app.use(cors());

// ด่าน 2: แปลง body ที่เป็น JSON ให้กลายเป็น object
// frontend ส่ง JSON.stringify(...) มา -> ฝั่งนี้อ่านผ่าน req.body ได้เลย
app.use(express.json());

// จับคู่ URL กับไฟล์ route:
// URL ขึ้นต้นด้วยอะไร -> ส่งต่อให้ไฟล์ไหนจัดการ
app.use("/api/auth", authRoutes);              // /api/auth/login
app.use("/api/systems", systemRoutes);         // /api/systems
app.use("/api/change-requests", crRoutes);     // /api/change-requests/...

// เช็คว่า server ยังทำงาน: เปิด GET /api/health ใน browser
// (req = ของที่ client ส่งมา, res = ของที่เราตอบกลับ)
app.get("/api/health", (req, res) => res.json({ ok: true }));

// error handler กลาง — route ไหนเรียก next(err) จะตกลงมาที่นี่
// (สังเกต: มี 4 parameter — Express ดูจำนวน parameter
//  แล้วรู้เองว่าอันนี้คือตัวจัดการ error)
app.use((err, req, res, next) => {
  console.error(err);  // โชว์ error เต็มๆ ใน Terminal ให้เราอ่าน
  // แต่ตอบ client แบบกลางๆ — ไม่ส่งรายละเอียด error ให้คนนอกเห็น
  res.status(500).json({ error: "Internal server error" });
});

// สั่ง server เริ่มรอรับ request ที่ port 4000
// (|| 4000 = ถ้าใน .env ไม่ได้ตั้ง PORT ไว้ ใช้ 4000)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});

// ============================================
// db.js — ตัวต่อกับ SQL Server (ใช้ร่วมทุก route)
// ============================================
//
// ปัญหาที่ไฟล์นี้แก้: ทุก route ต้องคุยกับ database
// ถ้าเปิด connection ใหม่ทุกครั้งที่มี request = ช้ามาก
//
// ทางแก้ = pool (สระว่ายน้ำของ connection):
// เปิด connection ค้างไว้ล่วงหน้าหลายเส้น ใครจะใช้ก็หยิบไป
// ใช้เสร็จคืนสระ ไม่ต้องเปิด/ปิดใหม่ทุกรอบ
//
// ⚠ หมายเหตุ: driver จริงของ SQL Server (mssql) ใช้ API คนละหน้าตากับ
// mysql2 ที่ LAB นี้ตั้งใจสอน (?, pool.query, insertId, beginTransaction...)
// ไฟล์นี้เลยห่อ (wrap) mssql ให้ "หน้าตาเหมือน mysql2" ทุก route ไฟล์อื่น
// (auth.js / systems.js / middleware/auth.js / cr.js) จึงยังเขียนโค้ด
// ตาม TODO/hint เดิมได้เป๊ะๆ โดยไม่ต้องรู้ว่าเบื้องหลังเปลี่ยนเป็น SQL Server แล้ว

// อ่านไฟล์ .env ก่อน — รหัส database อยู่ในนั้น
require("dotenv").config();

const sql = require("mssql");

const config = {
  server: process.env.DB_HOST || "localhost",   // database อยู่เครื่องไหน
  port: Number(process.env.DB_PORT) || 1433,    // SQL Server ฟังที่ port นี้ (default 1433)
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "CR",        // ชื่อ DB จาก schema.sql
  options: {
    encrypt: false,               // local dev ไม่ใช้ Azure ปิดไว้
    trustServerCertificate: true  // local dev cert ไม่ผ่าน CA ปกติ ข้ามการเช็คไปก่อน
  },
  pool: {
    max: 10,        // เปิดค้างสูงสุด 10 เส้น พอสำหรับโปรเจคเรา
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// เปิด connection pool ไว้รอ (ต่อครั้งเดียวตอน server สตาร์ท)
const poolPromise = new sql.ConnectionPool(config).connect();

// ── ตัวแปลง ? (สไตล์ mysql2) -> @p0, @p1, ... (สไตล์ mssql) ──
// ไล่ทีละตัวอักษร ข้าม ? ที่อยู่ใน string literal (คั่นด้วย ' ') ไป
function bindParams(request, text, params) {
  let paramIndex = 0;
  let inString = false;
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") inString = !inString;
    if (ch === "?" && !inString) {
      const name = `p${paramIndex}`;
      request.input(name, params[paramIndex]);
      out += `@${name}`;
      paramIndex++;
    } else {
      out += ch;
    }
  }
  return out;
}

// ── รัน query 1 ครั้ง แล้วแปลงผลลัพธ์ให้หน้าตาเหมือน mysql2 ──
// mysql2:  const [rows]  = await pool.query("SELECT ...")        -> rows = array แถว
//          const [result] = await conn.query("INSERT ...")       -> result.insertId
async function runQuery(request, text, params) {
  const converted = bindParams(request, text, params || []);

  // INSERT ของ mysql2 คืน insertId มาให้เลย — mssql ไม่มีอัตโนมัติ
  // เลยแอบต่อ SELECT SCOPE_IDENTITY() ท้าย INSERT ให้ (ถ้ายังไม่มี OUTPUT/SCOPE_IDENTITY เอง)
  const isInsert =
    /^\s*insert\b/i.test(converted) &&
    !/scope_identity/i.test(converted) &&
    !/output\s+inserted/i.test(converted);
  const finalText = isInsert
    ? `${converted}; SELECT SCOPE_IDENTITY() AS insertId;`
    : converted;

  try {
    const result = await request.query(finalText);

    if (isInsert) {
      const idRow = (result.recordset && result.recordset[0]) || {};
      return [{
        insertId: idRow.insertId != null ? Number(idRow.insertId) : undefined,
        affectedRows: result.rowsAffected ? result.rowsAffected[0] : undefined
      }];
    }
    return [result.recordset || []];
  } catch (err) {
    // เลข error ของ SQL Server ตอนชน UNIQUE constraint คือ 2627 / 2601
    // แปะ .code แบบ mysql2 ให้ — hint เดิม (err.code === "ER_DUP_ENTRY") ใช้ได้เลย
    if (err.number === 2627 || err.number === 2601) {
      err.code = "ER_DUP_ENTRY";
    }
    throw err;
  }
}

// ── หน้าตาแบบ mysql2 pool: pool.query(text, params) ──
async function query(text, params) {
  const p = await poolPromise;
  const request = new sql.Request(p);
  return runQuery(request, text, params);
}

// ── หน้าตาแบบ mysql2 pool.getConnection() — ไว้ใช้ตอนต้อง transaction ──
// (LAB 4B / 4C: ต้อง INSERT/UPDATE หลายคำสั่งบน "เส้นเดียวกัน"
//  พังกลางทางต้อง rollback ทั้งหมดได้)
async function getConnection() {
  const p = await poolPromise;
  const transaction = new sql.Transaction(p);
  let started = false;

  return {
    async beginTransaction() {
      await transaction.begin();
      started = true;
    },
    async query(text, params) {
      const request = started ? new sql.Request(transaction) : new sql.Request(p);
      return runQuery(request, text, params);
    },
    async commit() {
      await transaction.commit();
    },
    async rollback() {
      if (started) await transaction.rollback();
    },
    release() {
      // mssql จัดการคืน connection ให้ pool เองอัตโนมัติ — ไม่ต้องทำอะไรเพิ่ม
      // เก็บ method นี้ไว้เฉยๆ ให้โค้ดสไตล์ mysql2 (conn.release()) เรียกได้โดยไม่พัง
    }
  };
}

// ส่งออกให้ไฟล์อื่น require ไปใช้ — ทุก route ใช้ pool ตัวเดียวกันนี้
module.exports = { query, getConnection };

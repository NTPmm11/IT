// ============================================
// services/mailer.js — ส่ง e-mail แจ้งเตือน CR
// ============================================
//
// ไม่มี SMTP จริงใน .env (SMTP_HOST) -> ใช้ Ethereal (กล่องจดหมายปลอมสำหรับ dev)
// Ethereal สร้าง inbox ชั่วคราวให้อัตโนมัติ ไม่ต้องมี credential จริง
// ดูอีเมลที่ "ส่งไปแล้ว" ได้จาก preview URL ที่ log ออก console ตอน sendMail
//
// ใช้งานจริง: ใส่ SMTP_HOST/PORT/USER/PASS ใน .env แล้วจะสลับไปส่งผ่านนั้นแทนทันที

const nodemailer = require("nodemailer");

let transporterPromise;

function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === "true",
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined
        });
      }

      const testAccount = await nodemailer.createTestAccount();
      console.log("[mailer] ไม่พบ SMTP_HOST ใน .env -> ใช้ Ethereal test inbox แทน");
      console.log(`[mailer] login: ${testAccount.user} / ${testAccount.pass} (https://ethereal.email)`);

      return nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
    })();
  }
  return transporterPromise;
}

// to รับได้ทั้ง string เดียวหรือ array ของ email
async function sendMail({ to, subject, html }) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) return;

  try {
    const transporter = await getTransporter();
    // MAIL_FROM แยกจาก SMTP_USER เพราะ internal relay บางที่ (เช่น onemail.oneeclick.co)
    // ยอม relay แบบไม่ auth ได้ — from เลยเป็นคนละ address กับ SMTP_USER ก็ได้ (หรือไม่มี SMTP_USER เลยก็ได้)
    // Gmail จะบังคับ from = SMTP_USER เท่านั้น เลย fallback ไปใช้ SMTP_USER ถ้าไม่ได้ตั้ง MAIL_FROM ไว้
    const fromEmail = process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@cr-system.local";
    const fromName = process.env.MAIL_FROM_NAME || "CR System";
    const from = `"${fromName}" <${fromEmail}>`;
    const info = await transporter.sendMail({
      from,
      to: recipients.join(", "),
      subject,
      html
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`[mailer] preview: ${previewUrl}`);
  } catch (err) {
    // แจ้งเตือนอีเมลพลาด ไม่ควรทำให้ request หลักล้มตาม — แค่ log ไว้
    console.error("[mailer] sendMail failed:", err.message);
  }
}

module.exports = { sendMail };

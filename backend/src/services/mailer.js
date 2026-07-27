// ============================================
// services/mailer.js — ส่ง e-mail แจ้งเตือน CR
// ============================================
//
// ไม่มี SMTP จริงใน .env (SMTP_HOST) -> ใช้ Ethereal (กล่องจดหมายปลอมสำหรับ dev)
// Ethereal สร้าง inbox ชั่วคราวให้อัตโนมัติ ไม่ต้องมี credential จริง
// ดูอีเมลที่ "ส่งไปแล้ว" ได้จาก preview URL ที่ log ออก console ตอน sendMail
//
// ใช้งานจริง: ใส่ SMTP_HOST/PORT/USER/PASS ใน .env แล้วจะสลับไปส่งผ่านนั้นแทนทันที
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง (require ไฟล์นี้): routes/cr.js เท่านั้น — เรียก sendMail() ตอน submit CR ใหม่
//   (แจ้ง approver) และตอนบันทึกผลพิจารณา (แจ้งผู้ร้องขอ) พร้อม renderEmail() ห่อ HTML สวยๆ ให้
// ปลายทาง: require("nodemailer") ยิงออก SMTP จริง (ตาม .env) หรือ Ethereal (fake inbox ตอน dev)
// แยกออกมาเป็นไฟล์ต่างหาก (ไม่เขียนสดใน cr.js) เพราะ "การส่งเมล" เป็นคนละหน้าที่กับ "จัดการ CR"
// — cr.js ตัดสินใจว่า "ควรส่งเมลไหม/ส่งหาใคร" ส่วนไฟล์นี้ตัดสินใจว่า "จะส่งยังไง" (SMTP ไหน, ล้มแล้วทำไง)

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// to รับได้ทั้ง string เดียวหรือ array ของ email
async function sendMail({ to, subject, html }) {
  const raw = Array.isArray(to) ? to : [to];
  const recipients = raw.filter(Boolean).filter(addr => {
    const valid = EMAIL_RE.test(addr);
    if (!valid) console.warn(`[mailer] ข้าม email รูปแบบไม่ถูกต้อง: ${addr}`);
    return valid;
  });
  if (recipients.length === 0) return;

  if (!subject || !html) {
    console.warn("[mailer] sendMail ถูกเรียกโดยไม่มี subject/html — ข้าม");
    return;
  }

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

// bodyHtml ของ renderEmail() ถูกแปะลง <div> ตรงๆ ไม่ผ่านการ escape — ถ้าเอาข้อความที่ผู้ใช้พิมพ์เอง
// (subject/comment) ไปต่อ string ใส่ตรงๆ โดยไม่ escape ก่อน คนร้ายพิมพ์ <a href="..."> ลงช่อง subject
// ก็แปะลิงก์ปลอม/HTML แปลกปลอมลงอีเมลที่ส่งจริงได้ (HTML injection) — escapeHtml() ตัวนี้กันไว้
// ใช้ห่อเฉพาะค่าที่มาจากผู้ใช้ก่อนต่อเข้า bodyHtml เสมอ (ดูตัวอย่างใน routes/cr.js)
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

// สร้าง HTML e-mail แบบ card สวยๆ (inline CSS ทั้งหมด — client mail ส่วนใหญ่ตัด <style> ทิ้ง)
// heading/bodyHtml = เนื้อหา, ctaText/ctaUrl = ปุ่มลิงก์ (ใส่ก็ได้ไม่ใส่ก็ได้)
function renderEmail({ heading, bodyHtml, ctaText, ctaUrl }) {
  return `
  <div style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f4f5f7;padding:24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr>
        <td style="background:#4f46e5;padding:20px 24px;">
          <span style="color:#ffffff;font-size:18px;font-weight:600;">CR System</span>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">${heading}</h2>
          <div style="font-size:14px;color:#374151;line-height:1.7;">${bodyHtml}</div>
          ${ctaUrl ? `<div style="margin-top:24px;"><a href="${ctaUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:6px;font-size:14px;font-weight:600;">${ctaText}</a></div>` : ""}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <span style="font-size:12px;color:#9ca3af;">อีเมลนี้ส่งอัตโนมัติจากระบบ CR System กรุณาอย่าตอบกลับ</span>
        </td>
      </tr>
    </table>
  </div>`;
}

module.exports = { sendMail, renderEmail, escapeHtml };

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

// renderEmail() escape ค่าใน fields[].value ให้อัตโนมัติอยู่แล้ว (ดู fieldRows ด้านล่าง)
// export ตัวนี้ไว้เผื่อไฟล์อื่นต้องแปะ HTML ดิบเอง (fields[].value + raw:true) — ตอนนั้นค่อยเรียกเอง
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

// สร้าง HTML e-mail หน้าตาแบบ "ใบเอกสาร" ให้เข้าธีมกับฟอร์มจริงในเว็บ ไม่ใช่การ์ด SaaS ทั่วไป
// (inline CSS ทั้งหมด — mail client ส่วนใหญ่ตัด <style> ทิ้ง)
//
// สี/ฟอนต์/เลย์เอาต์ทั้งหมดยกมาจาก frontend/src/assets/css จริง ไม่ได้เลือกเอง:
//   letterhead (เส้นคั่นล่างหนา, จัดกลาง)  ลอกมาจาก .header-section
//   field label:value 2 คอลัมน์              ลอกมาจาก .form-group
//   สี navy #00075a / maroon #5a0000         ตัวเว็บทั้งระบบใช้สีนี้อยู่แล้ว
//   ปุ่ม pill navy                            ลอกมาจาก .btn-submit
//
// heading  = หัวเรื่องของอีเมลนี้
// fields   = [{ label, value, raw }] แถว label:value (เช่น เลขที่เอกสาร, เรื่อง)
//   value ถูก escape ให้อัตโนมัติเสมอ (กัน HTML injection โดยที่ผู้เรียกไม่ต้องจำ escapeHtml เอง)
//   ต้องการแปะ HTML จริงๆ (เช่น <b>) ใส่ raw: true — ใช้เฉพาะค่าที่ backend สร้างเอง ไม่ใช่ข้อความผู้ใช้พิมพ์
// statusText/statusColor = ใส่เมื่อมีผลพิจารณา (ข้อความตัวหนาสีเดียว ไม่ทำ pill — เอกสารทางการไม่ใช้ badge)
// ctaText/ctaUrl = ปุ่มลิงก์ (ใส่ก็ได้ไม่ใส่ก็ได้)
// ค่าที่ถูกเอาไปวางใน href — ยอมเฉพาะ http/https
// กัน javascript:/data: ที่บาง mail client ยังกดได้ และกัน " ที่จะปิด attribute ก่อนเวลา
function safeUrl(url) {
  const text = String(url ?? "").trim();
  if (!/^https?:\/\//i.test(text)) return "";
  return escapeHtml(text);
}

// ค่าที่ถูกเอาไปวางใน style="color:..." — ยอมเฉพาะ hex color
function safeColor(color) {
  return /^#[0-9a-f]{3,8}$/i.test(String(color ?? "")) ? color : "#3b3b3b";
}

function renderEmail({ heading, fields = [], statusText, statusColor, ctaText, ctaUrl }) {
  // ตอนนี้ผู้เรียกส่งแต่ค่าที่ระบบสร้างเอง แต่ escape ไว้ทุกช่องตั้งแต่ต้น
  // เดิม escape แค่ f.value ช่องเดียว — วันที่มีคนส่งค่าจากผู้ใช้เข้ามาทาง heading
  // หรือ ctaText จะกลายเป็น HTML injection ในเมลทันทีโดยไม่มีอะไรเตือน
  const safeHeading = escapeHtml(heading);
  const safeStatusText = statusText ? escapeHtml(statusText) : "";
  const safeStatusColor = safeColor(statusColor);
  const safeCtaText = escapeHtml(ctaText);
  const safeCtaUrl = safeUrl(ctaUrl);
  const fieldRows = fields.map(f => `
        <tr>
          <td style="padding:9px 16px 9px 0;width:110px;font-size:13.5px;font-weight:600;color:#000000;vertical-align:top;white-space:nowrap;">${f.label}</td>
          <td style="padding:9px 0;font-size:14px;color:#3b3b3b;line-height:1.6;">${f.raw ? f.value : escapeHtml(f.value)}</td>
        </tr>`).join("");

  return `
  <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f5f7;padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;">
      <tr>
        <td style="text-align:center;border-bottom:3px solid #00075a;padding:26px 32px 20px;">
          <div style="font-size:12px;letter-spacing:1px;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">ระบบขออนุมัติเปลี่ยนแปลงระบบงาน</div>
          <div style="font-size:20px;font-weight:800;color:#00112c;">CR System</div>
        </td>
      </tr>
      <tr>
        <td style="padding:26px 32px 4px;">
          <div style="font-size:16px;font-weight:700;color:#00112c;">${safeHeading}</div>
          ${safeStatusText ? `<div style="font-size:14px;font-weight:700;color:${safeStatusColor};margin-top:6px;">${safeStatusText}</div>` : ""}
        </td>
      </tr>
      <tr>
        <td style="padding:14px 32px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;">
            ${fieldRows}
          </table>
        </td>
      </tr>
      ${safeCtaUrl ? `
      <tr>
        <td style="padding:22px 32px 8px;">
          <a href="${safeCtaUrl}" style="display:inline-block;background:#00075a;color:#ffffff;text-decoration:none;padding:11px 26px;border-radius:50px;font-size:14px;font-weight:600;">${safeCtaText}</a>
        </td>
      </tr>` : ""}
      <tr>
        <td style="padding:24px 32px 22px;border-top:2px dashed #e5e7eb;margin-top:10px;">
          <span style="font-size:11.5px;color:#9ca3af;">อีเมลนี้ส่งอัตโนมัติจากระบบ CR System กรุณาอย่าตอบกลับ</span>
        </td>
      </tr>
    </table>
  </div>`;
}

module.exports = { sendMail, renderEmail, escapeHtml };

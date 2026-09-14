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
    console.error("[mailer] sendMail failed:", err.message);
  }
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function safeUrl(url) {
  const text = String(url ?? "").trim();
  if (!/^https?:\/\//i.test(text)) return "";
  return escapeHtml(text);
}

function safeColor(color) {
  return /^#[0-9a-f]{3,8}$/i.test(String(color ?? "")) ? color : "#3b3b3b";
}

function renderEmail({ heading, fields = [], statusText, statusColor, ctaText, ctaUrl }) {
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

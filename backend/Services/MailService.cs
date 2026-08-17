using System.Globalization;
using System.Text.RegularExpressions;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ChangeRequest.Api.Services;

// ============================================
// MailService — ส่ง e-mail แจ้งเตือน CR
// ============================================
//
// ตั้ง SMTP_HOST ใน .env = ส่งออกจริงผ่าน SMTP นั้น
// ไม่ตั้ง = โหมด dev: ไม่ส่งออกไปไหน เขียนไฟล์ .eml ลง MailDrop/ + log path ไว้
// (ของเดิมฝั่ง Node ใช้ Ethereal สร้าง inbox ปลอมให้อัตโนมัติ — MailKit ไม่มี API นั้น
//  ไฟล์ .eml เปิดดูได้ด้วย mail client ทั่วไป ไม่ต้องต่อเน็ต)
//
// ใครใช้: ChangeRequestsController — ตอน submit CR ใหม่ (แจ้ง approver)
// และตอนบันทึกผลพิจารณา (แจ้งผู้ร้องขอ)

public interface IMailService
{
    Task SendAsync(IEnumerable<string?> to, string subject, string html, CancellationToken ct = default);
    /// <summary>ยิงแล้วไม่รอผล — อีเมลพลาดไม่ควรทำให้ request หลักล้มตาม</summary>
    void SendInBackground(IEnumerable<string?> to, string subject, string html);
}

public sealed partial class MailService(IConfiguration config, ILogger<MailService> logger) : IMailService
{
    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex EmailPattern();

    public void SendInBackground(IEnumerable<string?> to, string subject, string html)
    {
        var recipients = to.ToList();
        _ = Task.Run(async () =>
        {
            try
            {
                await SendAsync(recipients, subject, html);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[mailer] ส่งอีเมลไม่สำเร็จ");
            }
        });
    }

    public async Task SendAsync(IEnumerable<string?> to, string subject, string html, CancellationToken ct = default)
    {
        var recipients = new List<string>();
        foreach (var address in to)
        {
            if (string.IsNullOrWhiteSpace(address)) continue;
            if (!EmailPattern().IsMatch(address))
            {
                logger.LogWarning("[mailer] ข้าม email รูปแบบไม่ถูกต้อง: {Address}", address);
                continue;
            }
            recipients.Add(address);
        }

        if (recipients.Count == 0) return;

        if (string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(html))
        {
            logger.LogWarning("[mailer] ถูกเรียกโดยไม่มี subject/html — ข้าม");
            return;
        }

        var message = BuildMessage(recipients, subject, html);

        var host = config["SMTP_HOST"];
        if (string.IsNullOrWhiteSpace(host))
        {
            await DropToDiskAsync(message, ct);
            return;
        }

        var port = int.TryParse(config["SMTP_PORT"], out var parsedPort) ? parsedPort : 587;
        // SMTP_SECURE=true = TLS ตั้งแต่เชื่อมต่อ (implicit, ปกติ port 465)
        // ไม่ตั้ง = STARTTLS ถ้า server รองรับ (ปกติ port 587) ไม่รองรับก็ส่ง plain
        var security = string.Equals(config["SMTP_SECURE"], "true", StringComparison.OrdinalIgnoreCase)
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTlsWhenAvailable;

        using var client = new SmtpClient();
        await client.ConnectAsync(host, port, security, ct);

        var user = config["SMTP_USER"];
        if (!string.IsNullOrWhiteSpace(user))
        {
            await client.AuthenticateAsync(user, config["SMTP_PASS"] ?? "", ct);
        }

        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);

        logger.LogInformation("[mailer] ส่งแล้ว: {Subject} -> {Recipients}", subject, string.Join(", ", recipients));
    }

    private MimeMessage BuildMessage(IEnumerable<string> recipients, string subject, string html)
    {
        // MAIL_FROM แยกจาก SMTP_USER เพราะ internal relay บางที่ยอม relay แบบไม่ auth ได้
        // (from เป็นคนละ address กับ SMTP_USER ได้ หรือไม่มี SMTP_USER เลยก็ได้)
        // Gmail บังคับ from = SMTP_USER เลย fallback ไปใช้ SMTP_USER ถ้าไม่ได้ตั้ง MAIL_FROM
        var fromEmail = config["MAIL_FROM"] ?? config["SMTP_USER"] ?? "no-reply@cr-system.local";
        var fromName = config["MAIL_FROM_NAME"] ?? "CR System";

        var message = new MimeMessage { Subject = subject };
        message.From.Add(new MailboxAddress(fromName, fromEmail));
        foreach (var address in recipients) message.To.Add(MailboxAddress.Parse(address));
        message.Body = new BodyBuilder { HtmlBody = html }.ToMessageBody();
        return message;
    }

    private async Task DropToDiskAsync(MimeMessage message, CancellationToken ct)
    {
        var folder = Path.Combine(AppContext.BaseDirectory, "MailDrop");
        Directory.CreateDirectory(folder);

        // InvariantCulture ตรงๆ — เครื่องที่ตั้ง locale ไทยจะได้ปี พ.ศ. ในชื่อไฟล์ (25690817)
        var stamp = DateTime.Now.ToString("yyyyMMdd-HHmmss-fff", CultureInfo.InvariantCulture);
        var path = Path.Combine(folder, $"{stamp}.eml");
        await using (var stream = File.Create(path))
        {
            await message.WriteToAsync(stream, ct);
        }

        logger.LogInformation("[mailer] ไม่พบ SMTP_HOST ใน .env -> เขียนอีเมลลงไฟล์แทน: {Path}", path);
    }
}

using System.Globalization;
using System.Text.RegularExpressions;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ChangeRequest.Api.Services;

public interface IMailService
{
    Task SendAsync(IEnumerable<string?> to, string subject, string html, CancellationToken ct = default);
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

        var stamp = DateTime.Now.ToString("yyyyMMdd-HHmmss-fff", CultureInfo.InvariantCulture);
        var path = Path.Combine(folder, $"{stamp}.eml");
        await using (var stream = File.Create(path))
        {
            await message.WriteToAsync(stream, ct);
        }

        logger.LogInformation("[mailer] ไม่พบ SMTP_HOST ใน .env -> เขียนอีเมลลงไฟล์แทน: {Path}", path);
    }
}

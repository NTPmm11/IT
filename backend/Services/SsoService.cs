using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;

namespace ChangeRequest.Api.Services;

public sealed class SsoOptions
{
    public const string HttpClientName = "sso";

    public required string BaseUrl { get; init; }
    public required string TokenPath { get; init; }
    public required SymmetricSecurityKey SigningKey { get; init; }
    public required string Issuer { get; init; }
    public required string Audience { get; init; }
    public required bool AcceptAnyCertificate { get; init; }

    public string? StartupWarning { get; init; }

    public static SsoOptions FromConfiguration(IConfiguration config)
    {
        var secret = config["SSO_JWT_SECRET"];
        string? warning = null;

        if (string.IsNullOrWhiteSpace(secret))
        {
            secret = "This is onee secret key for authentication";
            warning = "ไม่ได้ตั้ง SSO_JWT_SECRET ใน .env -> ใช้ค่า default ของ ONEE " +
                      "(ตรงกับที่ ONEE-Library/ONEE-ESS ใช้ แต่ควรตั้งเองให้ชัดเจน)";
        }

        var acceptAnyCert = !bool.TryParse(config["SSO_VERIFY_CERT"], out var verify) || !verify;

        return new SsoOptions
        {
            BaseUrl = (config["SSO_BASE_URL"] ?? "https://10.10.0.28:7054").TrimEnd('/'),
            TokenPath = config["SSO_TOKEN_PATH"] ?? "/api/auth/token",
            SigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
            Issuer = config["SSO_JWT_ISSUER"] ?? "ONEENext",
            Audience = config["SSO_JWT_AUDIENCE"] ?? "Everyone",
            AcceptAnyCertificate = acceptAnyCert,
            StartupWarning = warning
        };
    }
}

public sealed record SsoLoginResult(bool Ok, int StatusCode, string? AccessToken, string? Error);

public interface ISsoService
{
    Task<SsoLoginResult> LoginAsync(string username, string password, CancellationToken ct);

    /// <summary>sub ของ token ONEE มีรูป "ชื่อเต็ม|ADUser" — คืน (username, fullName)</summary>
    (string Username, string FullName)? ReadSubject(string token);
}

public sealed class SsoService(
    IHttpClientFactory httpClients,
    SsoOptions options,
    ILogger<SsoService> logger) : ISsoService
{
    public async Task<SsoLoginResult> LoginAsync(string username, string password, CancellationToken ct)
    {
        var client = httpClients.CreateClient(SsoOptions.HttpClientName);

        HttpResponseMessage response;
        try
        {
            response = await client.PostAsJsonAsync(
                options.BaseUrl + options.TokenPath,
                new { username, password },
                ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "ต่อ SSO ({BaseUrl}) ไม่ได้", options.BaseUrl);
            return new SsoLoginResult(false, StatusCodes.Status503ServiceUnavailable, null,
                "ต่อระบบยืนยันตัวตน (SSO) ไม่ได้ — เช็ค network หรือ VPN แล้วลองใหม่");
        }

        var raw = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogInformation("SSO ปฏิเสธ {Username} ({Status})", username, (int)response.StatusCode);
            return new SsoLoginResult(false, (int)response.StatusCode, null,
                "Username หรือ password ไม่ถูกต้อง");
        }

        string? accessToken;
        try
        {
            using var doc = JsonDocument.Parse(raw);
            accessToken = doc.RootElement.TryGetProperty("accessToken", out var element)
                          && element.ValueKind == JsonValueKind.String
                ? element.GetString()
                : null;
        }
        catch (JsonException)
        {
            accessToken = null;
        }

        if (string.IsNullOrWhiteSpace(accessToken))
        {
            logger.LogError("SSO ตอบ 200 แต่ไม่มี accessToken ใน response");
            return new SsoLoginResult(false, StatusCodes.Status502BadGateway, null,
                "ระบบยืนยันตัวตนตอบกลับมาในรูปแบบที่อ่านไม่ได้");
        }

        return new SsoLoginResult(true, 200, accessToken, null);
    }

    public (string Username, string FullName)? ReadSubject(string token)
    {
        JwtSecurityToken parsed;
        try
        {
            parsed = new JwtSecurityTokenHandler().ReadJwtToken(token);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "อ่าน token ที่ SSO ส่งมาไม่ได้");
            return null;
        }

        var subject = parsed.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Sub)?.Value;
        if (string.IsNullOrWhiteSpace(subject)) return null;

        return SplitSubject(subject);
    }

    public static (string Username, string FullName) SplitSubject(string subject)
    {
        var separator = subject.LastIndexOf('|');
        return separator < 0
            ? (subject.Trim(), subject.Trim())
            : (subject[(separator + 1)..].Trim(), subject[..separator].Trim());
    }
}

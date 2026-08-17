using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace ChangeRequest.Api.Services;

// ============================================
// TokenService — ออก JWT ให้ตอน login สำเร็จ
// ============================================
//
// ของเดิมพิสูจน์ตัวตนด้วย header X-User-Id เฉยๆ = ใครใส่เลขอะไรก็เป็นคนนั้นได้
// (ใส่ 1 = กลายเป็น it_admin ทันที) ตอนนี้เปลี่ยนเป็น JWT:
// token ถูกเซ็นด้วย secret ที่อยู่ฝั่ง server เท่านั้น แก้ payload แล้วลายเซ็นพัง
//
// ใครใช้: AuthController (ออก token) / Program.cs (ตั้งกติกาตรวจ token)

public sealed class JwtOptions
{
    public required SymmetricSecurityKey SigningKey { get; init; }
    public required string Issuer { get; init; }
    public required string Audience { get; init; }
    public required int ExpiresHours { get; init; }

    /// <summary>ข้อความเตือนตอนสตาร์ท (เช่น ไม่ได้ตั้ง JWT_SECRET) — null = ไม่มีอะไรต้องเตือน</summary>
    public string? StartupWarning { get; init; }

    public static JwtOptions FromConfiguration(IConfiguration config)
    {
        var secret = config["JWT_SECRET"];
        string? warning = null;

        // secret สั้นเกินไป = เดา/brute force ได้ HMAC-SHA256 ต้องการอย่างน้อย 32 ไบต์
        if (string.IsNullOrWhiteSpace(secret) || Encoding.UTF8.GetByteCount(secret) < 32)
        {
            // ไม่ hardcode ค่า default ไว้ในโค้ด (คนอื่นอ่าน repo แล้วปลอม token ได้ทันที)
            // สุ่มใหม่ทุกครั้งที่สตาร์ทแทน — restart ทีนึง token เดิมใช้ไม่ได้ ต้อง login ใหม่
            var random = RandomNumberGenerator.GetBytes(64);
            secret = Convert.ToBase64String(random);
            warning = "ไม่ได้ตั้ง JWT_SECRET ใน .env (หรือสั้นกว่า 32 ตัวอักษร) -> " +
                      "สร้าง key ชั่วคราวให้ ทุกครั้งที่ restart จะต้อง login ใหม่";
        }

        return new JwtOptions
        {
            SigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
            Issuer = config["JWT_ISSUER"] ?? "cr-system",
            Audience = config["JWT_AUDIENCE"] ?? "cr-system",
            ExpiresHours = int.TryParse(config["JWT_EXPIRES_HOURS"], out var hours) && hours > 0 ? hours : 8,
            StartupWarning = warning
        };
    }
}

public interface ITokenService
{
    /// <summary>ออก token ให้ user ที่ login ผ่านแล้ว</summary>
    string Create(int userId, string username, string role);
}

public sealed class TokenService(JwtOptions options) : ITokenService
{
    public string Create(int userId, string username, string role)
    {
        // sub = ตัวตนหลัก (user_id) — RequireAuth เอาไปหา user ใน database ต่อ
        // role/name แนบไว้ให้อ่านง่าย แต่ไม่ใช้ตัดสินสิทธิ์ (role จริงอ่านสดจาก database ทุก request
        // ไม่งั้นเปลี่ยน role ในระบบแล้ว token เก่ายังถือสิทธิ์เดิมจนหมดอายุ)
        Claim[] claims =
        [
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, username),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new("role", role)
        ];

        var token = new JwtSecurityToken(
            issuer: options.Issuer,
            audience: options.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddHours(options.ExpiresHours),
            signingCredentials: new SigningCredentials(options.SigningKey, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

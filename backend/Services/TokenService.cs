using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace ChangeRequest.Api.Services;

public sealed class JwtOptions
{
    public required SymmetricSecurityKey SigningKey { get; init; }
    public required string Issuer { get; init; }
    public required string Audience { get; init; }
    public required int ExpiresHours { get; init; }

    public string? StartupWarning { get; init; }

    public static JwtOptions FromConfiguration(IConfiguration config)
    {
        var secret = config["JWT_SECRET"];
        string? warning = null;

        if (string.IsNullOrWhiteSpace(secret) || Encoding.UTF8.GetByteCount(secret) < 32)
        {
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
    string Create(int userId, string username, string role);
}

public sealed class TokenService(JwtOptions options) : ITokenService
{
    public string Create(int userId, string username, string role)
    {
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

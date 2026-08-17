using ChangeRequest.Api.Configuration;
using ChangeRequest.Api.Data;
using ChangeRequest.Api.Models;
using ChangeRequest.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ChangeRequest.Api.Controllers;

// ============================================
// AuthController — POST /api/auth/login
// ============================================
//
// เส้นทางของการ login:
// 1. frontend (views/LoginView.vue) ส่ง username/password มา
// 2. ค้น user ในตาราง users
// 3. เทียบรหัสผ่านกับ hash ใน database (bcrypt)
// 4. ถูก -> ตอบข้อมูล user กลับไป / ผิด -> 401
//    (frontend เก็บ user ไว้ localStorage แล้วแนบ X-User-Id ทุก request หลังจากนี้)
//
// เส้นนี้ไม่มี [RequireAuth] — จุดนี้คือตอนที่ "ยังไม่ login" ไม่มี X-User-Id ให้เช็ค

[ApiController]
[Route("api/auth")]
[Tags("Auth")]
public sealed class AuthController(
    ISqlConnectionFactory connections,
    ITokenService tokens,
    JwtOptions jwtOptions,
    ILogger<AuthController> logger) : ControllerBase
{
    private sealed class UserRow
    {
        public int UserId { get; set; }
        public string Username { get; set; } = "";
        public string PasswordHash { get; set; } = "";
        public string FullName { get; set; } = "";
        public string? Department { get; set; }
        public string Role { get; set; } = "";
    }

    /// <summary>Login</summary>
    /// <response code="200">Login สำเร็จ ได้ข้อมูล user กลับมา</response>
    /// <response code="400">กรอกข้อมูลไม่ครบ</response>
    /// <response code="401">Username หรือ password ไม่ถูกต้อง</response>
    [HttpPost("login")]
    [EnableRateLimiting(RateLimitPolicies.Login)]
    [ProducesResponseType<LoginResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Username) || string.IsNullOrWhiteSpace(body.Password))
        {
            return BadRequest(new ErrorResponse("ต้องกรอก username และ password"));
        }

        await using var db = await connections.OpenAsync(ct);
        var user = await db.QuerySingleOrDefaultAsync<UserRow>(
            """
            SELECT user_id, username, password_hash, full_name, department, role
            FROM users
            WHERE username = @Username AND is_active = 1
            """,
            new { body.Username });

        // database เก็บ hash (เข้ารหัสทางเดียว ถอดกลับไม่ได้) ไม่ได้เก็บรหัสผ่านตรงๆ
        // ไม่บอกว่า "username ผิด" หรือ "password ผิด" — กันคนร้ายเดา username ที่มีจริง
        if (user is null || !VerifyPassword(body.Password, user.PasswordHash))
        {
            return Unauthorized(new ErrorResponse("Username หรือ password ไม่ถูกต้อง"));
        }

        // token คือสิ่งที่พิสูจน์ตัวตนจริง — ก้อน user ที่ส่งกลับไปด้วยมีไว้ให้หน้าเว็บ
        // เอาไปโชว์ชื่อ/ซ่อนปุ่มตาม role เฉยๆ ฝั่ง server ไม่เชื่อค่าพวกนี้
        return Ok(new LoginResponse
        {
            User = new LoginUserDto
            {
                UserId = user.UserId,
                Username = user.Username,
                FullName = user.FullName,
                Department = user.Department,
                Role = user.Role
            },
            Token = tokens.Create(user.UserId, user.Username, user.Role),
            ExpiresAt = DateTime.UtcNow.AddHours(jwtOptions.ExpiresHours)
        });
    }

    // hash ใน database อาจเสียรูป (เช่น seed ที่ยังเป็น '$2y$10$REPLACE_WITH_REAL_HASH')
    // BCrypt.Verify โยน SaltParseException ใส่ — ถ้าปล่อยหลุดจะกลายเป็น 500
    // ทั้งที่ความหมายจริงคือ "รหัสผ่านไม่ผ่าน" เลยดักไว้แล้วตอบ false
    private bool VerifyPassword(string password, string hash)
    {
        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            logger.LogWarning("password_hash ใน database ไม่ใช่ bcrypt hash ที่ถูกต้อง");
            return false;
        }
    }
}

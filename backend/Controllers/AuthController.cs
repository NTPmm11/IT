using System.IdentityModel.Tokens.Jwt;
using ChangeRequest.Api.Configuration;
using ChangeRequest.Api.Data;
using ChangeRequest.Api.Models;
using ChangeRequest.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ChangeRequest.Api.Controllers;

[ApiController]
[Route("api/auth")]
[Tags("Auth")]
public sealed class AuthController(
    ISqlConnectionFactory connections,
    ISsoService sso,
    ILogger<AuthController> logger) : ControllerBase
{
    private sealed class UserRow
    {
        public int UserId { get; set; }
        public string Username { get; set; } = "";
        public string FullName { get; set; } = "";
        public string? Department { get; set; }
        public string Role { get; set; } = "";
    }

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

        // password ไม่ได้เก็บในระบบนี้แล้ว — ส่งไปให้ SSO ของ ONEE ตรวจกับ AD
        var result = await sso.LoginAsync(body.Username, body.Password, ct);
        if (!result.Ok)
        {
            return StatusCode(result.StatusCode, new ErrorResponse(result.Error ?? "เข้าสู่ระบบไม่สำเร็จ"));
        }

        var subject = sso.ReadSubject(result.AccessToken!);
        if (subject is null)
        {
            return StatusCode(StatusCodes.Status502BadGateway,
                new ErrorResponse("token จากระบบยืนยันตัวตนไม่มีข้อมูลผู้ใช้"));
        }

        var (username, fullName) = subject.Value;

        await using var db = await connections.OpenAsync(ct);
        var user = await db.QuerySingleOrDefaultAsync<UserRow>(
            """
            SELECT user_id AS UserId, username AS Username, full_name AS FullName,
                   department AS Department, role AS Role
            FROM users
            WHERE username = @Username AND is_active = 1
            """,
            new { Username = username });

        // AD ยืนยันตัวตนผ่านแล้วแต่ยังไม่เคยเข้าระบบนี้ — เปิดสิทธิ์ requester ให้อัตโนมัติ
        // (ยื่นคำขอได้อย่างเดียว ส่วนอนุมัติ/ประเมินผลกระทบยังต้องให้ admin เลื่อน role ให้)
        if (user is null)
        {
            var userId = await db.QuerySingleAsync<int>(
                """
                INSERT INTO users (username, full_name, role)
                OUTPUT INSERTED.user_id
                VALUES (@Username, @FullName, 'requester')
                """,
                new { Username = username, FullName = string.IsNullOrWhiteSpace(fullName) ? username : fullName });

            logger.LogInformation("สร้าง user ใหม่จาก AD: {Username} (user_id {UserId})", username, userId);

            user = new UserRow
            {
                UserId = userId,
                Username = username,
                FullName = fullName,
                Role = "requester"
            };
        }

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
            // token ของ SSO ส่งต่อให้ frontend ตรงๆ — ระบบนี้ไม่ได้ออก token เอง
            Token = result.AccessToken!,
            ExpiresAt = ReadExpiry(result.AccessToken!)
        });
    }

    private static DateTime ReadExpiry(string token)
    {
        try
        {
            return new JwtSecurityTokenHandler().ReadJwtToken(token).ValidTo;
        }
        catch
        {
            return DateTime.UtcNow.AddHours(8);
        }
    }
}

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

        if (user is null || !VerifyPassword(body.Password, user.PasswordHash))
        {
            return Unauthorized(new ErrorResponse("Username หรือ password ไม่ถูกต้อง"));
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
            Token = tokens.Create(user.UserId, user.Username, user.Role),
            ExpiresAt = DateTime.UtcNow.AddHours(jwtOptions.ExpiresHours)
        });
    }

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

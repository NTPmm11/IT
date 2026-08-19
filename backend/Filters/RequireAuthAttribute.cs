using System.IdentityModel.Tokens.Jwt;
using ChangeRequest.Api.Data;
using ChangeRequest.Api.Models;
using ChangeRequest.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ChangeRequest.Api.Filters;

public sealed class RequireAuthAttribute() : TypeFilterAttribute(typeof(RequireAuthFilter));

public sealed class RequireAuthFilter(ISqlConnectionFactory connections) : IAsyncAuthorizationFilter
{
    public const string CurrentUserKey = "CurrentUser";

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var principal = context.HttpContext.User;

        if (principal.Identity?.IsAuthenticated != true)
        {
            var hasHeader = context.HttpContext.Request.Headers.Authorization.Count > 0;
            context.Result = new UnauthorizedObjectResult(new ErrorResponse(
                hasHeader ? "Invalid or expired token" : "Missing bearer token"));
            return;
        }

        // token มาจาก SSO ของ ONEE — sub มีรูป "ชื่อเต็ม|ADUser" ไม่ใช่ user_id
        var subject = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (string.IsNullOrWhiteSpace(subject))
        {
            context.Result = new UnauthorizedObjectResult(new ErrorResponse("Invalid or expired token"));
            return;
        }

        var (username, _) = SsoService.SplitSubject(subject);

        await using var db = await connections.OpenAsync(context.HttpContext.RequestAborted);
        var user = await db.QuerySingleOrDefaultAsync<CurrentUser>(
            """
            SELECT user_id AS UserId, username AS Username, role AS Role
            FROM users
            WHERE username = @Username AND is_active = 1
            """,
            new { Username = username });

        if (user is null)
        {
            context.Result = new UnauthorizedObjectResult(new ErrorResponse("Unknown user"));
            return;
        }

        context.HttpContext.Items[CurrentUserKey] = user;
    }
}

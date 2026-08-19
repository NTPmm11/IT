using ChangeRequest.Api.Models;

namespace ChangeRequest.Api.Filters;

public static class HttpContextExtensions
{
    public static CurrentUser CurrentUser(this HttpContext context)
        => context.Items[RequireAuthFilter.CurrentUserKey] as CurrentUser
           ?? throw new InvalidOperationException("ไม่พบ CurrentUser — action นี้ลืมติด [RequireAuth]");
}

using ChangeRequest.Api.Models;

namespace ChangeRequest.Api.Filters;

public static class HttpContextExtensions
{
    /// <summary>
    /// user ที่ [RequireAuth] ตรวจผ่านแล้ว — เรียกได้เฉพาะ action ที่ติด [RequireAuth]
    /// (ไม่มี = โยน InvalidOperationException ให้รู้ตอน dev ว่าลืมติด attribute)
    /// </summary>
    public static CurrentUser CurrentUser(this HttpContext context)
        => context.Items[RequireAuthFilter.CurrentUserKey] as CurrentUser
           ?? throw new InvalidOperationException("ไม่พบ CurrentUser — action นี้ลืมติด [RequireAuth]");
}

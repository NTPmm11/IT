using ChangeRequest.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ChangeRequest.Api.Filters;

// ============================================
// RequireRole — ด่านที่ 2: role ของ user มีสิทธิ์ทำสิ่งนี้ไหม
// ============================================
//
// ใช้คู่กับ [RequireAuth] เสมอ และทำงานหลังเสมอ (Order = 1)
// เพราะอ่าน user จาก HttpContext.Items ที่ RequireAuth เป็นคนใส่ไว้
//
//   [RequireAuth]
//   [RequireRole("approver", "it_admin")]

/// <summary>จำกัดเฉพาะ role ที่ระบุ — ต้องใช้คู่กับ [RequireAuth]</summary>
public sealed class RequireRoleAttribute : TypeFilterAttribute
{
    public RequireRoleAttribute(params string[] roles) : base(typeof(RequireRoleFilter))
    {
        Arguments = [roles];
        Order = 1;   // RequireAuth เป็น 0 (default) — ตัวนี้ต้องหลัง
    }
}

public sealed class RequireRoleFilter(string[] roles) : IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        // RequireAuth ตอบ 401 ไปแล้ว — ไม่ต้องทับด้วย 403
        if (context.Result is not null) return;

        var user = context.HttpContext.Items[RequireAuthFilter.CurrentUserKey] as CurrentUser;
        if (user is null || !roles.Contains(user.Role))
        {
            context.Result = new ObjectResult(new ErrorResponse("Forbidden: insufficient role"))
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }
    }
}

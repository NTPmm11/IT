using ChangeRequest.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ChangeRequest.Api.Filters;

public sealed class RequireRoleAttribute : TypeFilterAttribute
{
    public RequireRoleAttribute(params string[] roles) : base(typeof(RequireRoleFilter))
    {
        Arguments = [roles];
        Order = 1;
    }
}

public sealed class RequireRoleFilter(string[] roles) : IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
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

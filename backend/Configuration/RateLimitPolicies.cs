namespace ChangeRequest.Api.Configuration;

public static class RateLimitPolicies
{
    /// <summary>จำกัดจำนวนครั้งที่ยิง POST /api/auth/login ได้ต่อ IP ต่อนาที</summary>
    public const string Login = "login";
}

using System.Text.Json.Serialization;

namespace ChangeRequest.Api.Models;

// ============================================
// Models/Dtos.cs — รูปร่าง JSON ที่ตอบกลับ frontend
// ============================================
//
// ชื่อ key ทุกตัวล็อกด้วย [JsonPropertyName] เพราะ frontend อ่านชื่อ column
// ตรงๆ จาก database (cr_number, request_date, ...) ปนกับชื่อแบบ camelCase
// (crId, crNumber, changeTypes) — ปล่อยให้ serializer เดาเองไม่ได้
//
// Dapper map column -> property ด้วย DefaultTypeMap.MatchNamesWithUnderscores = true
// (ตั้งไว้ใน Program.cs) เช่น cr_number -> CrNumber

/// <summary>ผู้ใช้ที่ผ่านด่าน X-User-Id แล้ว — เก็บไว้ใน HttpContext.Items</summary>
public sealed class CurrentUser
{
    public int UserId { get; init; }
    public string Username { get; init; } = "";
    public string Role { get; init; } = "";
}

public sealed class LoginRequest
{
    public string? Username { get; set; }
    public string? Password { get; set; }
}

public sealed class LoginUserDto
{
    [JsonPropertyName("userId")] public int UserId { get; set; }
    [JsonPropertyName("username")] public string Username { get; set; } = "";
    [JsonPropertyName("fullName")] public string FullName { get; set; } = "";
    [JsonPropertyName("department")] public string? Department { get; set; }
    [JsonPropertyName("role")] public string Role { get; set; } = "";
}

public sealed class LoginResponse
{
    [JsonPropertyName("user")] public LoginUserDto User { get; set; } = new();

    /// <summary>JWT ที่ frontend ต้องแนบกลับมาทุก request (Authorization: Bearer ...)</summary>
    [JsonPropertyName("token")] public string Token { get; set; } = "";

    /// <summary>token หมดอายุเมื่อไหร่ (ISO 8601, UTC)</summary>
    [JsonPropertyName("expiresAt")] public DateTime ExpiresAt { get; set; }
}

public sealed class SystemDto
{
    [JsonPropertyName("system_code")] public string SystemCode { get; set; } = "";
    [JsonPropertyName("system_name")] public string SystemName { get; set; } = "";
}

/// <summary>1 แถวในหน้ารายการ CR (GET /api/change-requests)</summary>
public sealed class ChangeRequestListItem
{
    [JsonPropertyName("cr_id")] public int CrId { get; set; }
    [JsonPropertyName("cr_number")] public string CrNumber { get; set; } = "";
    [JsonPropertyName("request_date")] public DateTime? RequestDate { get; set; }
    [JsonPropertyName("subject")] public string Subject { get; set; } = "";
    [JsonPropertyName("priority")] public string Priority { get; set; } = "";
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("requester")] public string Requester { get; set; } = "";
    [JsonPropertyName("system_name")] public string SystemName { get; set; } = "";
}

/// <summary>หัวใบ CR (ส่วนที่มาจากตาราง change_requests ตรงๆ)</summary>
public sealed class ChangeRequestHeader
{
    [JsonPropertyName("cr_id")] public int CrId { get; set; }
    [JsonPropertyName("cr_number")] public string CrNumber { get; set; } = "";

    /// <summary>ใช้เช็คสิทธิ์ฝั่ง server เท่านั้น — ไม่ส่งออกไปกับ JSON</summary>
    [JsonIgnore] public int RequesterId { get; set; }

    [JsonPropertyName("request_date")] public DateTime? RequestDate { get; set; }
    [JsonPropertyName("department")] public string? Department { get; set; }
    [JsonPropertyName("contact")] public string? Contact { get; set; }
    [JsonPropertyName("priority")] public string Priority { get; set; } = "";
    [JsonPropertyName("subject")] public string Subject { get; set; } = "";
    [JsonPropertyName("problem")] public string? Problem { get; set; }
    [JsonPropertyName("request_detail")] public string? RequestDetail { get; set; }
    [JsonPropertyName("impact")] public string Impact { get; set; } = "";
    [JsonPropertyName("impact_detail")] public string? ImpactDetail { get; set; }
    [JsonPropertyName("downtime")] public bool Downtime { get; set; }
    [JsonPropertyName("duration")] public string? Duration { get; set; }
    [JsonPropertyName("deploy_date")] public DateTime? DeployDate { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("created_at")] public DateTime CreatedAt { get; set; }
    [JsonPropertyName("requester")] public string Requester { get; set; } = "";
    [JsonPropertyName("system_name")] public string SystemName { get; set; } = "";

    // ── ส่วนที่อยู่คนละตาราง (1 CR ต่อหลายแถว) ประกอบเข้ามาทีหลัง ──
    [JsonPropertyName("changeTypes")] public IReadOnlyList<string> ChangeTypes { get; set; } = [];
    [JsonPropertyName("plan")] public IReadOnlyList<PlanRowDto> Plan { get; set; } = [];
    [JsonPropertyName("rollbackPlan")] public IReadOnlyList<PlanRowDto> RollbackPlan { get; set; } = [];
    [JsonPropertyName("approvals")] public IReadOnlyList<ApprovalDto> Approvals { get; set; } = [];
}

/// <summary>1 ขั้นตอนในตารางแผนดำเนินงาน / แผนกู้คืน (โครงเดียวกันทั้งคู่)</summary>
public sealed class PlanRowDto
{
    [JsonPropertyName("step")] public string Step { get; set; } = "";
    [JsonPropertyName("start_date")] public string? StartDate { get; set; }
    [JsonPropertyName("end_date")] public string? EndDate { get; set; }
    [JsonPropertyName("owner")] public string? Owner { get; set; }
    [JsonPropertyName("note")] public string? Note { get; set; }
}

public sealed class ApprovalDto
{
    [JsonPropertyName("result")] public string Result { get; set; } = "";
    [JsonPropertyName("comment")] public string? Comment { get; set; }
    [JsonPropertyName("approval_date")] public DateTime? ApprovalDate { get; set; }
    [JsonPropertyName("approver")] public string Approver { get; set; } = "";
}

// ── ขาเข้า (request body) ──
// ชื่อ property ตรงกับที่ frontend/src/views/FormView.vue ส่งมา (buildPayload)
// JSON binding ของ ASP.NET Core เทียบชื่อแบบ case-insensitive อยู่แล้ว

public sealed class PlanRowInput
{
    public string? Step { get; set; }
    public string? Start { get; set; }
    public string? End { get; set; }
    public string? Owner { get; set; }
    public string? Note { get; set; }
}

public sealed class CreateChangeRequestInput
{
    public string? RequestDate { get; set; }
    public string? Department { get; set; }
    public string? SystemCode { get; set; }
    public string? Contact { get; set; }
    public string? Priority { get; set; }
    public string? Subject { get; set; }
    public string? Problem { get; set; }
    public string? RequestDetail { get; set; }
    public string? Impact { get; set; }
    public string? ImpactDetail { get; set; }
    public bool Downtime { get; set; }
    public string? Duration { get; set; }
    public string? DeployDate { get; set; }
    public string? Status { get; set; }
    public List<string>? ChangeTypes { get; set; }
    public List<PlanRowInput>? Plan { get; set; }
    public List<PlanRowInput>? RollbackPlan { get; set; }
}

public sealed class ApprovalInput
{
    public string? Result { get; set; }
    public string? Comment { get; set; }
    public string? ApprovalDate { get; set; }
}

/// <summary>รูปแบบ error เดียวกันทั้งระบบ — frontend อ่าน data.error (services/api.js)</summary>
public sealed class ErrorResponse(string error)
{
    [JsonPropertyName("error")] public string Error { get; set; } = error;
}

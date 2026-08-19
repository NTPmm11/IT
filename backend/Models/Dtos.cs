using System.Text.Json.Serialization;

namespace ChangeRequest.Api.Models;

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

    [JsonPropertyName("token")] public string Token { get; set; } = "";

    [JsonPropertyName("expiresAt")] public DateTime ExpiresAt { get; set; }
}

public sealed class SystemDto
{
    [JsonPropertyName("system_code")] public string SystemCode { get; set; } = "";
    [JsonPropertyName("system_name")] public string SystemName { get; set; } = "";
}

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

public sealed class ChangeRequestHeader
{
    [JsonPropertyName("cr_id")] public int CrId { get; set; }
    [JsonPropertyName("cr_number")] public string CrNumber { get; set; } = "";

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

    [JsonPropertyName("changeTypes")] public IReadOnlyList<string> ChangeTypes { get; set; } = [];
    [JsonPropertyName("plan")] public IReadOnlyList<PlanRowDto> Plan { get; set; } = [];
    [JsonPropertyName("rollbackPlan")] public IReadOnlyList<PlanRowDto> RollbackPlan { get; set; } = [];
    [JsonPropertyName("approvals")] public IReadOnlyList<ApprovalDto> Approvals { get; set; } = [];
}

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

public sealed class ErrorResponse(string error)
{
    [JsonPropertyName("error")] public string Error { get; set; } = error;
}

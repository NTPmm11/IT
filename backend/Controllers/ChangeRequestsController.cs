using System.Globalization;
using ChangeRequest.Api.Data;
using ChangeRequest.Api.Filters;
using ChangeRequest.Api.Models;
using ChangeRequest.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace ChangeRequest.Api.Controllers;

[ApiController]
[Route("api/change-requests")]
[Tags("Change Requests")]
public sealed class ChangeRequestsController(
    ISqlConnectionFactory connections,
    IMailService mail,
    IConfiguration config) : ControllerBase
{
    private static readonly string[] AllowedPriorities = ["Low", "Medium", "High", "Critical"];
    private static readonly string[] AllowedImpacts = ["none", "other"];
    private static readonly string[] AllowedChangeTypes = ["App", "DB", "Infra"];
    private static readonly string[] AllowedResults = ["approved", "rejected", "more-info"];

    private static readonly string[] ApprovableStatuses = ["submitted", "more_info"];

    [HttpGet("next-number")]
    [RequireAuth]
    public async Task<IActionResult> NextNumber(CancellationToken ct)
    {
        await using var db = await connections.OpenAsync(ct);
        var next = await db.ExecuteScalarAsync<int?>(
            """
            SELECT CAST(current_value AS INT) + CAST(increment AS INT)
            FROM sys.sequences
            WHERE object_id = OBJECT_ID('dbo.cr_number_seq')
            """);

        if (next is null)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                new ErrorResponse("ยังไม่มี sequence cr_number_seq — รัน database/07_cr_number_sequence.sql ก่อน"));
        }

        return Ok(new { crNumber = FormatCrNumber(next.Value) });
    }

    [HttpGet]
    [RequireAuth]
    [ProducesResponseType<IEnumerable<ChangeRequestListItem>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> List(
        [FromQuery] string? status,
        [FromQuery] string? crNumber,
        [FromQuery] string? date,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken ct)
    {
        var currentUser = HttpContext.CurrentUser();

        var conditions = new List<string>();
        var parameters = new DynamicParameters();

        if (currentUser.Role == "requester")
        {
            conditions.Add("cr.requester_id = @CurrentUserId");
            parameters.Add("CurrentUserId", currentUser.UserId);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            conditions.Add("cr.status = @Status");
            parameters.Add("Status", status);
        }
        if (!string.IsNullOrWhiteSpace(crNumber))
        {
            conditions.Add(@"cr.cr_number LIKE @CrNumber ESCAPE '\'");
            parameters.Add("CrNumber", $"%{EscapeLike(crNumber)}%");
        }
        if (!string.IsNullOrWhiteSpace(date))
        {
            if (!TryParseDate(date, out var parsedDate))
            {
                return BadRequest(new ErrorResponse("รูปแบบ date ไม่ถูกต้อง (ต้องเป็น yyyy-MM-dd)"));
            }
            conditions.Add("cr.request_date = @RequestDate");
            parameters.Add("RequestDate", parsedDate);
        }

        var paging = "";
        if (page is not null || pageSize is not null)
        {
            var pageNumber = page ?? 1;
            var size = pageSize ?? 10;
            if (pageNumber < 1 || size is < 1 or > 200)
            {
                return BadRequest(new ErrorResponse("page ต้อง >= 1 และ pageSize ต้องอยู่ระหว่าง 1-200"));
            }
            paging = "OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY";
            parameters.Add("Skip", (pageNumber - 1) * size);
            parameters.Add("Take", size);
        }

        var where = conditions.Count > 0 ? $"WHERE {string.Join(" AND ", conditions)}" : "";

        await using var db = await connections.OpenAsync(ct);
        await using var results = await db.QueryMultipleAsync(
            $"""
             SELECT COUNT(*)
             FROM change_requests cr
             JOIN users u   ON u.user_id = cr.requester_id
             JOIN systems s ON s.system_id = cr.system_id
             {where};

             SELECT cr.cr_id, cr.cr_number, cr.request_date, cr.subject, cr.priority,
                    cr.status, u.full_name AS requester, s.system_name
             FROM change_requests cr
             JOIN users u   ON u.user_id = cr.requester_id
             JOIN systems s ON s.system_id = cr.system_id
             {where}
             ORDER BY cr.created_at DESC
             {paging};
             """,
            parameters);

        var total = await results.ReadSingleAsync<int>();
        var rows = await results.ReadAsync<ChangeRequestListItem>();

        Response.Headers["X-Total-Count"] = total.ToString(CultureInfo.InvariantCulture);
        return Ok(rows);
    }

    [HttpGet("{id}")]
    [RequireAuth]
    [ProducesResponseType<ChangeRequestHeader>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Detail(string id, CancellationToken ct)
    {
        var currentUser = HttpContext.CurrentUser();

        if (!int.TryParse(id, NumberStyles.None, CultureInfo.InvariantCulture, out var crId))
        {
            return BadRequest(new ErrorResponse("Invalid CR id"));
        }

        await using var db = await connections.OpenAsync(ct);
        await using var results = await db.QueryMultipleAsync(
            """
            SELECT cr.cr_id, cr.cr_number, cr.requester_id, cr.request_date, cr.department, cr.contact,
                   cr.priority, cr.subject, cr.problem, cr.request_detail,
                   cr.impact, cr.impact_detail, cr.downtime, cr.duration, cr.deploy_date,
                   cr.status, cr.created_at,
                   u.full_name AS requester, s.system_name
            FROM change_requests cr
            JOIN users u   ON u.user_id = cr.requester_id
            JOIN systems s ON s.system_id = cr.system_id
            WHERE cr.cr_id = @CrId;

            SELECT change_type FROM cr_change_types WHERE cr_id = @CrId;

            SELECT step, start_date, end_date, owner, note
            FROM cr_action_plans WHERE cr_id = @CrId ORDER BY seq_no;

            SELECT step, start_date, end_date, owner, note
            FROM cr_rollback_plans WHERE cr_id = @CrId ORDER BY seq_no;

            SELECT a.result, a.comment, a.approval_date, u.full_name AS approver
            FROM cr_approvals a
            JOIN users u ON u.user_id = a.approver_id
            WHERE a.cr_id = @CrId;
            """,
            new { CrId = crId });

        var cr = await results.ReadSingleOrDefaultAsync<ChangeRequestHeader>();
        if (cr is null)
        {
            return NotFound(new ErrorResponse("CR not found"));
        }

        if (currentUser.Role == "requester" && cr.RequesterId != currentUser.UserId)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                new ErrorResponse("Forbidden: ไม่ใช่ CR ของคุณ"));
        }

        cr.ChangeTypes = (await results.ReadAsync<string>()).ToList();
        cr.Plan = (await results.ReadAsync<PlanRowDto>()).ToList();
        cr.RollbackPlan = (await results.ReadAsync<PlanRowDto>()).ToList();
        cr.Approvals = (await results.ReadAsync<ApprovalDto>()).ToList();

        return Ok(cr);
    }

    [HttpPost]
    [RequireAuth]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateChangeRequestInput body, CancellationToken ct)
    {
        var currentUser = HttpContext.CurrentUser();

        var error = Validate(body, currentUser, out var input);
        if (error is not null) return error;

        await using var db = await connections.OpenAsync(ct);

        var systemId = await db.ExecuteScalarAsync<int?>(
            "SELECT system_id FROM systems WHERE system_code = @SystemCode",
            new { body.SystemCode });
        if (systemId is null)
        {
            return BadRequest(new ErrorResponse("Unknown systemCode"));
        }

        await using var tx = (SqlTransaction)await db.BeginTransactionAsync(ct);

        int crId;
        string crNumber;
        try
        {
            var seqValue = await db.ExecuteScalarAsync<int>(
                "SELECT NEXT VALUE FOR dbo.cr_number_seq", transaction: tx);
            crNumber = FormatCrNumber(seqValue);

            crId = await db.ExecuteScalarAsync<int>(
                """
                INSERT INTO change_requests
                  (cr_number, request_date, requester_id, department, system_id, contact,
                   priority, subject, problem, request_detail, impact, impact_detail,
                   downtime, duration, deploy_date, status)
                VALUES
                  (@CrNumber, @RequestDate, @RequesterId, @Department, @SystemId, @Contact,
                   @Priority, @Subject, @Problem, @RequestDetail, @Impact, @ImpactDetail,
                   @Downtime, @Duration, @DeployDate, @Status);
                SELECT CAST(SCOPE_IDENTITY() AS INT);
                """,
                new
                {
                    CrNumber = crNumber,
                    input.RequestDate,
                    RequesterId = currentUser.UserId,
                    Department = NullIfBlank(body.Department),
                    SystemId = systemId.Value,
                    Contact = NullIfBlank(body.Contact),
                    input.Priority,
                    Subject = body.Subject,
                    Problem = NullIfBlank(body.Problem),
                    RequestDetail = NullIfBlank(body.RequestDetail),
                    input.Impact,
                    input.ImpactDetail,
                    input.Downtime,
                    input.Duration,
                    input.DeployDate,
                    input.Status
                },
                tx);

            await ReplaceChildRowsAsync(db, tx, crId, input.ChangeTypes, body.Plan, body.RollbackPlan);

            await tx.CommitAsync(ct);
        }
        catch (SqlException ex) when (ex.Number is 2627 or 2601)
        {
            return Conflict(new ErrorResponse("สร้างเลขที่เอกสารชนกัน ลอง submit อีกครั้ง"));
        }
        catch (SqlException ex) when (ex.Number is 8152 or 2628)
        {
            return BadRequest(new ErrorResponse(
                "ข้อความในตารางแผนงานยาวเกินกำหนด (ขั้นตอน/หมายเหตุ 255, ผู้รับผิดชอบ 100, วันที่ 50 ตัวอักษร)"));
        }

        if (input.Status != "draft")
        {
            await NotifyApproversAsync(db, crId, crNumber, body.Subject!, ct);
        }

        return StatusCode(StatusCodes.Status201Created, new { crId, crNumber });
    }

    [HttpPut("{id}")]
    [RequireAuth]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(string id, [FromBody] CreateChangeRequestInput body, CancellationToken ct)
    {
        var currentUser = HttpContext.CurrentUser();

        if (!int.TryParse(id, NumberStyles.None, CultureInfo.InvariantCulture, out var crId))
        {
            return BadRequest(new ErrorResponse("Invalid CR id"));
        }

        var error = Validate(body, currentUser, out var input);
        if (error is not null) return error;

        await using var db = await connections.OpenAsync(ct);

        var existing = await db.QuerySingleOrDefaultAsync<EditTargetRow>(
            "SELECT cr_id, cr_number, requester_id, status FROM change_requests WHERE cr_id = @CrId",
            new { CrId = crId });
        if (existing is null)
        {
            return NotFound(new ErrorResponse("CR not found"));
        }

        var ownershipError = CheckOwnership(existing, currentUser);
        if (ownershipError is not null) return ownershipError;

        var systemId = await db.ExecuteScalarAsync<int?>(
            "SELECT system_id FROM systems WHERE system_code = @SystemCode",
            new { body.SystemCode });
        if (systemId is null)
        {
            return BadRequest(new ErrorResponse("Unknown systemCode"));
        }

        await using var tx = (SqlTransaction)await db.BeginTransactionAsync(ct);
        try
        {
            var updated = await db.ExecuteAsync(
                """
                UPDATE change_requests SET
                  request_date = @RequestDate, department = @Department, system_id = @SystemId,
                  contact = @Contact, priority = @Priority, subject = @Subject, problem = @Problem,
                  request_detail = @RequestDetail, impact = @Impact, impact_detail = @ImpactDetail,
                  downtime = @Downtime, duration = @Duration, deploy_date = @DeployDate,
                  status = @Status, updated_at = GETDATE()
                WHERE cr_id = @CrId AND status = 'draft'
                """,
                new
                {
                    CrId = crId,
                    input.RequestDate,
                    Department = NullIfBlank(body.Department),
                    SystemId = systemId.Value,
                    Contact = NullIfBlank(body.Contact),
                    input.Priority,
                    Subject = body.Subject,
                    Problem = NullIfBlank(body.Problem),
                    RequestDetail = NullIfBlank(body.RequestDetail),
                    input.Impact,
                    input.ImpactDetail,
                    input.Downtime,
                    input.Duration,
                    input.DeployDate,
                    input.Status
                },
                tx);

            if (updated == 0)
            {
                return BadRequest(new ErrorResponse("แก้ไขได้เฉพาะใบที่ยังเป็นร่าง (draft)"));
            }

            await ReplaceChildRowsAsync(db, tx, crId, input.ChangeTypes, body.Plan, body.RollbackPlan);

            await tx.CommitAsync(ct);
        }
        catch (SqlException ex) when (ex.Number is 8152 or 2628)
        {
            return BadRequest(new ErrorResponse(
                "ข้อความในตารางแผนงานยาวเกินกำหนด (ขั้นตอน/หมายเหตุ 255, ผู้รับผิดชอบ 100, วันที่ 50 ตัวอักษร)"));
        }

        if (input.Status != "draft")
        {
            await NotifyApproversAsync(db, crId, existing.CrNumber, body.Subject!, ct);
        }

        return Ok(new { crId, crNumber = existing.CrNumber });
    }

    [HttpDelete("{id}")]
    [RequireAuth]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        var currentUser = HttpContext.CurrentUser();

        if (!int.TryParse(id, NumberStyles.None, CultureInfo.InvariantCulture, out var crId))
        {
            return BadRequest(new ErrorResponse("Invalid CR id"));
        }

        await using var db = await connections.OpenAsync(ct);

        var existing = await db.QuerySingleOrDefaultAsync<EditTargetRow>(
            "SELECT cr_id, cr_number, requester_id, status FROM change_requests WHERE cr_id = @CrId",
            new { CrId = crId });
        if (existing is null)
        {
            return NotFound(new ErrorResponse("CR not found"));
        }

        var ownershipError = CheckOwnership(existing, currentUser);
        if (ownershipError is not null) return ownershipError;

        var deleted = await db.ExecuteAsync(
            "DELETE FROM change_requests WHERE cr_id = @CrId AND status = 'draft'",
            new { CrId = crId });

        if (deleted == 0)
        {
            return BadRequest(new ErrorResponse("ลบได้เฉพาะใบที่ยังเป็นร่าง (draft)"));
        }

        return NoContent();
    }

    [HttpPost("{id}/approval")]
    [RequireAuth]
    [RequireRole("approver", "it_admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Approve(string id, [FromBody] ApprovalInput body, CancellationToken ct)
    {
        var currentUser = HttpContext.CurrentUser();

        if (!int.TryParse(id, NumberStyles.None, CultureInfo.InvariantCulture, out var crId))
        {
            return BadRequest(new ErrorResponse("Invalid CR id"));
        }

        if (body.Result is null || !AllowedResults.Contains(body.Result))
        {
            return BadRequest(new ErrorResponse("result ต้องเป็น approved/rejected/more-info"));
        }

        if (!TryParseDate(body.ApprovalDate, out var approvalDate))
        {
            return BadRequest(new ErrorResponse("รูปแบบ approvalDate ไม่ถูกต้อง (ต้องเป็น yyyy-MM-dd)"));
        }

        await using var db = await connections.OpenAsync(ct);

        var cr = await db.QuerySingleOrDefaultAsync<ApprovalTargetRow>(
            """
            SELECT cr.cr_id, cr.cr_number, cr.subject, cr.status, cr.requester_id,
                   u.email AS requester_email
            FROM change_requests cr
            JOIN users u ON u.user_id = cr.requester_id
            WHERE cr.cr_id = @CrId
            """,
            new { CrId = crId });
        if (cr is null)
        {
            return NotFound(new ErrorResponse("CR not found"));
        }

        var allowSelfApproval = string.Equals(config["ALLOW_SELF_APPROVAL"], "true", StringComparison.OrdinalIgnoreCase);
        if (!allowSelfApproval && cr.RequesterId == currentUser.UserId)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                new ErrorResponse("อนุมัติคำขอที่ตัวเองยื่นไม่ได้"));
        }

        if (cr.Status == "draft")
        {
            return BadRequest(new ErrorResponse("CR ยังเป็นฉบับร่าง ยังไม่ได้ส่งเข้าพิจารณา"));
        }

        if (!ApprovableStatuses.Contains(cr.Status))
        {
            return Conflict(new ErrorResponse($"CR นี้พิจารณาไปแล้ว (สถานะ: {cr.Status})"));
        }

        await using (var tx = (SqlTransaction)await db.BeginTransactionAsync(ct))
        {
            var statusValue = body.Result == "more-info" ? "more_info" : body.Result;

            var updated = await db.ExecuteAsync(
                """
                UPDATE change_requests
                SET status = @Status, updated_at = GETDATE()
                WHERE cr_id = @CrId AND status IN ('submitted', 'more_info')
                """,
                new { Status = statusValue, CrId = crId },
                tx);

            if (updated == 0)
            {
                return Conflict(new ErrorResponse("CR นี้เพิ่งถูกพิจารณาไปแล้ว"));
            }

            await db.ExecuteAsync(
                """
                INSERT INTO cr_approvals (cr_id, approver_id, result, comment, approval_date)
                VALUES (@CrId, @ApproverId, @Result, @Comment, @ApprovalDate)
                """,
                new
                {
                    CrId = crId,
                    ApproverId = currentUser.UserId,
                    Result = body.Result,
                    Comment = NullIfBlank(body.Comment),
                    ApprovalDate = approvalDate
                },
                tx);

            await tx.CommitAsync(ct);
        }

        NotifyRequester(cr, body.Result, body.Comment);

        return StatusCode(StatusCodes.Status201Created, new { ok = true });
    }

    private sealed class ApprovalTargetRow
    {
        public int CrId { get; set; }
        public string CrNumber { get; set; } = "";
        public string Subject { get; set; } = "";
        public string Status { get; set; } = "";
        public int RequesterId { get; set; }
        public string? RequesterEmail { get; set; }
    }

    private sealed class EditTargetRow
    {
        public int CrId { get; set; }
        public string CrNumber { get; set; } = "";
        public int RequesterId { get; set; }
        public string Status { get; set; } = "";
    }

    private sealed record ValidatedInput(
        DateTime? RequestDate,
        DateTime? DeployDate,
        string Priority,
        string Impact,
        string? ImpactDetail,
        bool Downtime,
        string? Duration,
        List<string> ChangeTypes,
        string Status);

    private ActionResult? Validate(CreateChangeRequestInput body, CurrentUser user, out ValidatedInput input)
    {
        input = null!;

        if (string.IsNullOrWhiteSpace(body.Subject) || string.IsNullOrWhiteSpace(body.SystemCode))
        {
            return BadRequest(new ErrorResponse("ต้องมี subject, systemCode"));
        }

        if (!TryParseDate(body.RequestDate, out var requestDate))
        {
            return BadRequest(new ErrorResponse("รูปแบบ requestDate ไม่ถูกต้อง (ต้องเป็น yyyy-MM-dd)"));
        }
        if (!TryParseDate(body.DeployDate, out var deployDate))
        {
            return BadRequest(new ErrorResponse("รูปแบบ deployDate ไม่ถูกต้อง (ต้องเป็น yyyy-MM-dd)"));
        }

        var tooLong = FirstTooLong(
            ("subject", body.Subject, 255),
            ("systemCode", body.SystemCode, 20),
            ("department", body.Department, 100),
            ("contact", body.Contact, 100),
            ("impactDetail", body.ImpactDetail, 255),
            ("duration", body.Duration, 50));
        if (tooLong is not null)
        {
            return BadRequest(new ErrorResponse(tooLong));
        }

        var priority = string.IsNullOrWhiteSpace(body.Priority) ? "Low" : body.Priority;
        if (!AllowedPriorities.Contains(priority))
        {
            return BadRequest(new ErrorResponse($"priority ต้องเป็น {string.Join("/", AllowedPriorities)}"));
        }

        var isItAdmin = user.Role == "it_admin";

        var impact = isItAdmin && !string.IsNullOrWhiteSpace(body.Impact) ? body.Impact : "none";
        if (!AllowedImpacts.Contains(impact))
        {
            return BadRequest(new ErrorResponse($"impact ต้องเป็น {string.Join("/", AllowedImpacts)}"));
        }

        List<string> changeTypes = isItAdmin
            ? (body.ChangeTypes ?? []).Distinct().ToList()
            : [];
        if (changeTypes.Any(t => !AllowedChangeTypes.Contains(t)))
        {
            return BadRequest(new ErrorResponse($"changeTypes ต้องเป็น {string.Join("/", AllowedChangeTypes)}"));
        }

        input = new ValidatedInput(
            RequestDate: requestDate,
            DeployDate: isItAdmin ? deployDate : null,
            Priority: priority,
            Impact: impact,
            ImpactDetail: isItAdmin ? NullIfBlank(body.ImpactDetail) : null,
            Downtime: isItAdmin && body.Downtime,
            Duration: isItAdmin ? NullIfBlank(body.Duration) : null,
            ChangeTypes: changeTypes,
            Status: body.Status == "draft" ? "draft" : "submitted");

        return null;
    }

    private ActionResult? CheckOwnership(EditTargetRow cr, CurrentUser user)
        => user.Role == "it_admin" || cr.RequesterId == user.UserId
            ? null
            : StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("Forbidden: ไม่ใช่ CR ของคุณ"));

    private static async Task ReplaceChildRowsAsync(
        SqlConnection db, SqlTransaction tx, int crId,
        List<string> changeTypes, List<PlanRowInput>? plan, List<PlanRowInput>? rollbackPlan)
    {
        await db.ExecuteAsync(
            """
            DELETE FROM cr_change_types   WHERE cr_id = @CrId;
            DELETE FROM cr_action_plans   WHERE cr_id = @CrId;
            DELETE FROM cr_rollback_plans WHERE cr_id = @CrId;
            """,
            new { CrId = crId }, tx);

        if (changeTypes.Count > 0)
        {
            await db.ExecuteAsync(
                "INSERT INTO cr_change_types (cr_id, change_type) VALUES (@CrId, @ChangeType)",
                changeTypes.Select(t => new { CrId = crId, ChangeType = t }),
                tx);
        }

        await InsertPlanRowsAsync(db, tx, "cr_action_plans", crId, plan);
        await InsertPlanRowsAsync(db, tx, "cr_rollback_plans", crId, rollbackPlan);
    }

    private static string EscapeLike(string value) => value
        .Replace(@"\", @"\\")
        .Replace("%", @"\%")
        .Replace("_", @"\_")
        .Replace("[", @"\[");

    private static string FormatCrNumber(int crId) => $"CR{crId:D7}";

    private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;

    private static string? FirstTooLong(params (string Field, string? Value, int Max)[] fields)
    {
        foreach (var (field, value, max) in fields)
        {
            if (value?.Length > max) return $"{field} ยาวเกิน {max} ตัวอักษร";
        }
        return null;
    }

    private static bool TryParseDate(string? raw, out DateTime? value)
    {
        value = null;
        if (string.IsNullOrWhiteSpace(raw)) return true;

        if (!DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            return false;
        }

        value = parsed.Date;
        return true;
    }

    private static async Task InsertPlanRowsAsync(
        SqlConnection db, SqlTransaction tx, string table, int crId, List<PlanRowInput>? rows)
    {
        if (rows is null || rows.Count == 0) return;

        var filled = rows.Where(row =>
            !string.IsNullOrWhiteSpace(row.Step) ||
            !string.IsNullOrWhiteSpace(row.Start) ||
            !string.IsNullOrWhiteSpace(row.End) ||
            !string.IsNullOrWhiteSpace(row.Owner) ||
            !string.IsNullOrWhiteSpace(row.Note)).ToList();

        if (filled.Count == 0) return;

        var seq = 1;
        var values = filled.Select(row => new
        {
            CrId = crId,
            SeqNo = seq++,
            Step = row.Step ?? "",
            StartDate = NullIfBlank(row.Start),
            EndDate = NullIfBlank(row.End),
            Owner = NullIfBlank(row.Owner),
            Note = NullIfBlank(row.Note)
        }).ToList();

        await db.ExecuteAsync(
            $"""
             INSERT INTO {table} (cr_id, seq_no, step, start_date, end_date, owner, note)
             VALUES (@CrId, @SeqNo, @Step, @StartDate, @EndDate, @Owner, @Note)
             """,
            values,
            tx);
    }

    private async Task NotifyApproversAsync(
        SqlConnection db, int crId, string crNumber, string subject, CancellationToken ct)
    {
        var approvers = await db.QueryAsync<string?>(
            "SELECT email FROM users WHERE role IN ('approver','it_admin') AND is_active = 1");

        var frontendUrl = config["FRONTEND_URL"] ?? "http://localhost:5173";
        var approveLink = $"{frontendUrl}/approve?crId={crId}";

        mail.SendInBackground(
            approvers,
            $"[CR] มีคำขอใหม่รอพิจารณา: {crNumber}",
            EmailRenderer.Render(
                heading: "มีคำขอ Change Request ใหม่รอพิจารณา",
                fields:
                [
                    new EmailField("เลขที่เอกสาร", $"<b>{EmailRenderer.Escape(crNumber)}</b>", Raw: true),
                    new EmailField("เรื่อง", subject)
                ],
                ctaText: "ไปหน้าพิจารณา",
                ctaUrl: approveLink));
    }

    private void NotifyRequester(ApprovalTargetRow cr, string result, string? comment)
    {
        var resultText = result switch
        {
            "approved" => "อนุมัติ",
            "rejected" => "ไม่อนุมัติ",
            _ => "ขอข้อมูลเพิ่มเติม"
        };
        var resultColor = result switch
        {
            "approved" => "#16a34a",
            "rejected" => "#dc2626",
            _ => "#d97706"
        };

        var fields = new List<EmailField> { new("เรื่อง", cr.Subject) };
        if (!string.IsNullOrWhiteSpace(comment)) fields.Add(new EmailField("ความเห็น", comment));

        mail.SendInBackground(
            [cr.RequesterEmail],
            $"[CR] ผลการพิจารณา {cr.CrNumber}: {resultText}",
            EmailRenderer.Render(
                heading: $"ผลการพิจารณาคำขอ {cr.CrNumber}",
                fields: fields,
                statusText: resultText,
                statusColor: resultColor));
    }
}

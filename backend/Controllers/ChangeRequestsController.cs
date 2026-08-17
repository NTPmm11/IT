using System.Globalization;
using ChangeRequest.Api.Data;
using ChangeRequest.Api.Filters;
using ChangeRequest.Api.Models;
using ChangeRequest.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace ChangeRequest.Api.Controllers;

// ============================================
// ChangeRequestsController — CRUD change requests + approval
// ============================================
//
// GET  /api/change-requests             รายการ CR (filter ได้)
// GET  /api/change-requests/next-number เลขที่เอกสารตัวถัดไป (preview)
// GET  /api/change-requests/{id}        CR ตัวเดียว ครบทุกส่วน
// POST /api/change-requests             บันทึก CR ใหม่ (transaction 4 ตาราง)
// POST /api/change-requests/{id}/approval  บันทึกผลพิจารณา (transaction 2 ตาราง)
//
// mapping กับ database/*.sql:
//   change_requests    = ฟอร์ม section 1-3
//   cr_change_types    = checkbox ประเภทการเปลี่ยน (หลายค่า)
//   cr_action_plans    = ตารางแผนดำเนินงาน section 4
//   cr_rollback_plans  = ตารางแผนการกู้คืน (Roll Back Plan)
//   cr_approvals       = ผลพิจารณา section 5

[ApiController]
[Route("api/change-requests")]
[Tags("Change Requests")]
public sealed class ChangeRequestsController(
    ISqlConnectionFactory connections,
    IMailService mail,
    IConfiguration config) : ControllerBase
{
    // ค่าที่ column CHECK constraint ยอมรับ (ดู database/00_full_schema.sql)
    // เช็คฝั่งนี้ก่อน จะได้ตอบ 400 ที่ตรงความหมาย แทนที่จะปล่อยให้ constraint พังเป็น 500
    private static readonly string[] AllowedPriorities = ["Low", "Medium", "High", "Critical"];
    private static readonly string[] AllowedImpacts = ["none", "other"];
    private static readonly string[] AllowedChangeTypes = ["App", "DB", "Infra"];
    private static readonly string[] AllowedResults = ["approved", "rejected", "more-info"];

    // สถานะที่ยัง "รอผล" อยู่ — มีแค่ 2 อันนี้ที่พิจารณาได้
    // draft = ยังไม่ส่ง, approved/rejected = ตัดสินไปแล้ว
    private static readonly string[] ApprovableStatuses = ["submitted", "more_info"];

    // ============================================
    // GET /api/change-requests/next-number
    // ============================================
    // อ่าน SEQUENCE ตัวเดียวกับที่ใช้ออกเลขจริงตอน submit (database/07_cr_number_sequence.sql)
    // เดิมใช้ MAX(cr_id)+1 ซึ่งเป็นคนละตัวนับกับ IDENTITY ที่ออกเลขจริง — แถวถูกลบหรือ
    // insert ที่ rollback ทำให้ preview เพี้ยนถาวร (บอก CR0000008 แต่ได้จริง CR0000012)
    // เหลือแค่กรณีมีคนกด submit แทรกระหว่างเปิดฟอร์มค้างไว้ ซึ่งเลี่ยงไม่ได้

    /// <summary>เลขที่เอกสารตัวถัดไป (preview)</summary>
    /// <response code="200">เลขที่เอกสาร เช่น CR0000001</response>
    /// <response code="401">ไม่ได้ login</response>
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
            // ยังไม่ได้รัน database/07_cr_number_sequence.sql บน database เครื่องนี้
            return StatusCode(StatusCodes.Status500InternalServerError,
                new ErrorResponse("ยังไม่มี sequence cr_number_seq — รัน database/07_cr_number_sequence.sql ก่อน"));
        }

        return Ok(new { crNumber = FormatCrNumber(next.Value) });
    }

    // ============================================
    // GET /api/change-requests — list ทั้งหมด
    // ============================================
    // query string รองรับ filter (optional ทั้งหมด ใส่กี่ตัวพร้อมกันก็ได้):
    //   ?status=approved   ตรงตัว
    //   ?crNumber=CR6908   ค้นบางส่วน (LIKE)
    //   ?date=2026-07-24   ตรงกับ request_date

    /// <summary>รายการ CR ทั้งหมด (filter ได้)</summary>
    /// <param name="status">สถานะ (ตรงตัว)</param>
    /// <param name="crNumber">เลขที่เอกสาร — ค้นบางส่วน (LIKE)</param>
    /// <param name="date">วันที่ร้องขอ (yyyy-MM-dd)</param>
    /// <param name="page">หน้าที่ต้องการ (เริ่มที่ 1) — ไม่ส่ง = เอาทั้งหมด</param>
    /// <param name="pageSize">จำนวนแถวต่อหน้า (1-200)</param>
    /// <response code="200">รายการ CR — จำนวนทั้งหมดอยู่ใน header X-Total-Count</response>
    /// <response code="400">รูปแบบ date/page/pageSize ไม่ถูกต้อง</response>
    /// <response code="401">ไม่ได้ login</response>
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

        // requester เห็นเฉพาะใบที่ตัวเองยื่น — approver/it_admin เห็นทั้งหมด
        // (กรองที่ SQL ไม่ใช่หลังดึงมา ไม่งั้นข้อมูลคนอื่นวิ่งผ่าน server อยู่ดี)
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
            // ESCAPE: % _ [ ที่ผู้ใช้พิมพ์เองต้องเป็นตัวอักษรธรรมดา ไม่ใช่ wildcard
            // (เดิมพิมพ์ % ช่องเดียวได้ทุกแถวกลับมา — และ % นำหน้ายังทำให้ index ใช้ไม่ได้)
            conditions.Add(@"cr.cr_number LIKE @CrNumber ESCAPE '\'");
            parameters.Add("CrNumber", $"%{EscapeLike(crNumber)}%");
        }
        if (!string.IsNullOrWhiteSpace(date))
        {
            // ส่งข้อความมั่วๆ มาให้ SQL Server แปลงเองจะได้ 500 "Conversion failed"
            // แปลงเองตรงนี้แล้วตอบ 400 ที่ตรงกว่า
            if (!TryParseDate(date, out var parsedDate))
            {
                return BadRequest(new ErrorResponse("รูปแบบ date ไม่ถูกต้อง (ต้องเป็น yyyy-MM-dd)"));
            }
            conditions.Add("cr.request_date = @RequestDate");
            parameters.Add("RequestDate", parsedDate);
        }

        // ไม่ส่ง page มา = เอาทั้งหมด (ปุ่ม "PDF ย้อนหลัง" ฝั่งหน้าเว็บต้องได้ครบทุกแถว)
        // ส่งมา = ตัดหน้าที่ database เลย ไม่ใช่ดึงหมดแล้วค่อยตัดฝั่ง client อย่างเดิม
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

        // JOIN = ดึงข้ามตาราง: change_requests เก็บแค่ "รหัส" คนขอ/รหัสระบบ
        // อยากได้ "ชื่อ" ต้องไปเปิดตาราง users กับ systems ประกอบ
        // ยิง 2 คำสั่งในรอบเดียว: จำนวนทั้งหมด (ไว้คำนวณจำนวนหน้า) + แถวของหน้านี้
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

        // ส่งจำนวนทั้งหมดทาง header — body ยังเป็น array เหมือนเดิม โค้ดเก่าที่เรียกอยู่ไม่พัง
        Response.Headers["X-Total-Count"] = total.ToString(CultureInfo.InvariantCulture);
        return Ok(rows);
    }

    // ============================================
    // GET /api/change-requests/{id} — CR ตัวเดียว ครบทุกส่วน
    // ============================================
    // CR 1 ใบมีได้หลายประเภทการเปลี่ยน หลายขั้นตอนแผนงาน หลายผลพิจารณา
    // (เก็บคนละตาราง 1 CR ต่อหลายแถว) — ยิงทีเดียวด้วย QueryMultiple แล้วประกอบกลับ

    /// <summary>ดู CR ตัวเดียว ครบทุกส่วน</summary>
    /// <response code="200">รายละเอียด CR</response>
    /// <response code="400">Invalid CR id</response>
    /// <response code="401">ไม่ได้ login</response>
    /// <response code="403">เป็น CR ของคนอื่น</response>
    /// <response code="404">CR not found</response>
    [HttpGet("{id}")]
    [RequireAuth]
    [ProducesResponseType<ChangeRequestHeader>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Detail(string id, CancellationToken ct)
    {
        var currentUser = HttpContext.CurrentUser();

        // cr_id เป็น INT — ไม่ใช่เลขล้วนตอบ 400 ตรงนี้เลย
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

        // requester เปิดดูได้เฉพาะใบของตัวเอง (เดิมพิมพ์เลข id อะไรก็อ่านได้หมด)
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

    // ============================================
    // POST /api/change-requests — บันทึก CR ใหม่
    // ============================================
    // ต้อง INSERT ถึง 4 ตาราง (CR + ประเภท + แผนงาน + แผนกู้คืน)
    // ตารางแรกสำเร็จแล้วตารางถัดไปพัง = ข้อมูลค้างครึ่งๆ กลางๆ
    // transaction = "ทำทั้งหมด หรือไม่ทำเลยสักอย่าง"
    // (await using = ไม่ commit ก็ rollback ให้อัตโนมัติตอน dispose)

    /// <summary>บันทึก CR ใหม่</summary>
    /// <response code="201">สร้าง CR สำเร็จ</response>
    /// <response code="400">ข้อมูลไม่ครบ/ไม่ถูกต้อง หรือ systemCode ไม่รู้จัก</response>
    /// <response code="401">ไม่ได้ login</response>
    /// <response code="409">สร้างเลขที่เอกสารชนกัน ลอง submit อีกครั้ง</response>
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

        // frontend ส่ง systemCode (ข้อความ เช่น "HR") มา แต่ตาราง change_requests
        // ต้องการ system_id (เลข FK) เลยต้องแปลงค่าก่อน 1 รอบ
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
            // ขอเลขจาก SEQUENCE ก่อน insert — ไม่ต้องพึ่ง cr_id (IDENTITY) อีกแล้ว
            // เดิมต้องใส่เลขชั่วคราวไปก่อนแล้ว UPDATE ทับ เพราะ cr_id รู้ค่าหลัง insert เท่านั้น
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
                    // ไม่เชื่อ requesterId ที่ frontend ส่งมา — ใช้ user ที่ login จริงเท่านั้น
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
            // ชน UNIQUE constraint ของ cr_number — ลองใหม่อีกทีได้เลย
            return Conflict(new ErrorResponse("สร้างเลขที่เอกสารชนกัน ลอง submit อีกครั้ง"));
        }
        catch (SqlException ex) when (ex.Number is 8152 or 2628)
        {
            // ตาข่ายรับของช่องที่ไม่ได้เช็คความยาวไว้ล่วงหน้า (แถวในตารางแผนงาน)
            // 8152/2628 = "String or binary data would be truncated"
            return BadRequest(new ErrorResponse(
                "ข้อความในตารางแผนงานยาวเกินกำหนด (ขั้นตอน/หมายเหตุ 255, ผู้รับผิดชอบ 100, วันที่ 50 ตัวอักษร)"));
        }

        // ส่ง e-mail แจ้งผู้อนุมัติ — เฉพาะตอน submit จริง (draft ยังไม่ต้องแจ้งใคร)
        if (input.Status != "draft")
        {
            await NotifyApproversAsync(db, crId, crNumber, body.Subject!, ct);
        }

        return StatusCode(StatusCodes.Status201Created, new { crId, crNumber });
    }

    // ============================================
    // PUT /api/change-requests/{id} — แก้ไขใบที่ยังเป็นร่าง
    // ============================================
    // เดิมไม่มีเส้นนี้เลย — บันทึกร่างแล้วแก้ไม่ได้ ต้องสร้างใบใหม่ทิ้งใบเก่าไว้เกลื่อน
    // แก้ได้เฉพาะ status = draft และเฉพาะเจ้าของใบ (it_admin แก้ของใครก็ได้)
    // ส่ง status = "submitted" มาพร้อมกัน = แก้แล้วส่งเข้าพิจารณาเลยในครั้งเดียว
    // cr_number ไม่เปลี่ยน (เลขออกไปแล้วก็คือใบเดิม)

    /// <summary>แก้ไข CR (เฉพาะใบสถานะ draft ของตัวเอง)</summary>
    /// <response code="200">แก้ไขสำเร็จ</response>
    /// <response code="400">ข้อมูลไม่ถูกต้อง หรือใบนี้ไม่ใช่ร่างแล้ว</response>
    /// <response code="401">ไม่ได้ login</response>
    /// <response code="403">ไม่ใช่ใบของตัวเอง</response>
    /// <response code="404">CR not found</response>
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
            // ย้ำ status = 'draft' ใน WHERE อีกรอบ กันกรณีมีคนกด submit ใบเดียวกันแทรกเข้ามา
            // ระหว่างที่เราเช็คด้านบนกับตอนเขียนจริง (โดน 0 แถว = ใบนี้ไม่ใช่ร่างแล้ว)
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

            // ตารางลูกเป็นชุด "แทนที่ทั้งชุด" ไม่ใช่แก้ทีละแถว — ลบของเดิมแล้วใส่ชุดใหม่
            // (ผู้ใช้ลบแถวออกจากตารางในฟอร์มได้ ถ้าแค่ UPDATE แถวเก่าจะค้างอยู่)
            await ReplaceChildRowsAsync(db, tx, crId, input.ChangeTypes, body.Plan, body.RollbackPlan);

            await tx.CommitAsync(ct);
        }
        catch (SqlException ex) when (ex.Number is 8152 or 2628)
        {
            return BadRequest(new ErrorResponse(
                "ข้อความในตารางแผนงานยาวเกินกำหนด (ขั้นตอน/หมายเหตุ 255, ผู้รับผิดชอบ 100, วันที่ 50 ตัวอักษร)"));
        }

        // ร่าง -> ส่งเข้าพิจารณา = เพิ่งเข้าคิวจริงตอนนี้ ค่อยแจ้ง approver
        if (input.Status != "draft")
        {
            await NotifyApproversAsync(db, crId, existing.CrNumber, body.Subject!, ct);
        }

        return Ok(new { crId, crNumber = existing.CrNumber });
    }

    // ============================================
    // DELETE /api/change-requests/{id} — ลบใบร่างทิ้ง
    // ============================================
    // เฉพาะ draft และเฉพาะเจ้าของ (it_admin ลบของใครก็ได้)
    // ใบที่ส่งเข้าพิจารณาแล้วห้ามลบ — เป็นหลักฐานการขอที่ต้องเก็บไว้
    // แถวลูกทุกตารางมี ON DELETE CASCADE อยู่แล้ว หายตามไปเอง

    /// <summary>ลบ CR (เฉพาะใบสถานะ draft ของตัวเอง)</summary>
    /// <response code="204">ลบแล้ว</response>
    /// <response code="400">Invalid CR id หรือใบนี้ไม่ใช่ร่างแล้ว</response>
    /// <response code="401">ไม่ได้ login</response>
    /// <response code="403">ไม่ใช่ใบของตัวเอง</response>
    /// <response code="404">CR not found</response>
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

    // ============================================
    // POST /api/change-requests/{id}/approval — บันทึกผลพิจารณา
    // ============================================
    // ด่าน 2 ชั้น: RequireAuth แล้วต่อด้วย RequireRole
    // role requester หลุดมาถึงนี่จะโดน 403 เด้งกลับ

    /// <summary>บันทึกผลพิจารณา (approver/it_admin เท่านั้น)</summary>
    /// <response code="201">บันทึกผลสำเร็จ</response>
    /// <response code="400">Invalid CR id หรือ result ไม่ถูกต้อง</response>
    /// <response code="401">ไม่ได้ login</response>
    /// <response code="403">role ไม่มีสิทธิ์</response>
    /// <response code="404">CR not found</response>
    /// <response code="409">CR นี้พิจารณาไปแล้ว</response>
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

        // whitelist ค่าที่ยอมรับ — กันคนส่ง result มั่วๆ เข้ามาปนใน database
        if (body.Result is null || !AllowedResults.Contains(body.Result))
        {
            return BadRequest(new ErrorResponse("result ต้องเป็น approved/rejected/more-info"));
        }

        if (!TryParseDate(body.ApprovalDate, out var approvalDate))
        {
            return BadRequest(new ErrorResponse("รูปแบบ approvalDate ไม่ถูกต้อง (ต้องเป็น yyyy-MM-dd)"));
        }

        await using var db = await connections.OpenAsync(ct);

        // เช็คก่อนว่า CR เลขนี้มีอยู่จริงไหม ก่อนเริ่ม transaction
        // (ดึง cr_number/subject/email ผู้ร้องขอมาด้วย เอาไว้ส่ง e-mail แจ้งผลหลัง commit)
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

        // อนุมัติคำขอที่ตัวเองยื่นไม่ได้ — คนตรวจกับคนขอต้องคนละคน
        // (ตั้ง ALLOW_SELF_APPROVAL=true ใน .env ถ้าทีมเล็กและยอมรับได้)
        var allowSelfApproval = string.Equals(config["ALLOW_SELF_APPROVAL"], "true", StringComparison.OrdinalIgnoreCase);
        if (!allowSelfApproval && cr.RequesterId == currentUser.UserId)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                new ErrorResponse("อนุมัติคำขอที่ตัวเองยื่นไม่ได้"));
        }

        // ใบร่างยังไม่ได้ส่งเข้าขั้นตอนอนุมัติ — ไม่ควรพิจารณาได้
        if (cr.Status == "draft")
        {
            return BadRequest(new ErrorResponse("CR ยังเป็นฉบับร่าง ยังไม่ได้ส่งเข้าพิจารณา"));
        }

        // ตัดสินไปแล้วก็จบ — เดิมกดซ้ำได้ไม่จำกัด ได้แถวใน cr_approvals งอกทุกครั้ง
        // และ status ถูกเขียนทับเรื่อยๆ (approve แล้วมากด reject ทีหลังก็ยังได้)
        if (!ApprovableStatuses.Contains(cr.Status))
        {
            return Conflict(new ErrorResponse($"CR นี้พิจารณาไปแล้ว (สถานะ: {cr.Status})"));
        }

        await using (var tx = (SqlTransaction)await db.BeginTransactionAsync(ct))
        {
            // enum ใน schema ใช้ขีดล่าง แต่หน้าเว็บส่งขีดกลางมา (more-info -> more_info)
            var statusValue = body.Result == "more-info" ? "more_info" : body.Result;

            // อัปเดตสถานะก่อน แล้วเช็คว่าโดนกี่แถว — WHERE ย้ำเงื่อนไขสถานะอีกรอบ
            // เพราะระหว่างที่เช็คด้านบนกับตรงนี้ อาจมี approver อีกคนกดพร้อมกันพอดี
            // (โดน 0 แถว = อีกคนตัดสินไปก่อนแล้ว) เช็คด้วย SELECT อย่างเดียวกันเคสนี้ไม่ได้
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
                // ไม่ commit -> dispose ของ transaction rollback ให้เอง
                return Conflict(new ErrorResponse("CR นี้เพิ่งถูกพิจารณาไปแล้ว"));
            }

            // บันทึกผลพิจารณา (ใครอนุมัติ ผลอะไร คอมเมนต์อะไร)
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

    // ── ตัวช่วย ──

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

    /// <summary>ค่าที่ผ่านการตรวจ + ปรับตามสิทธิ์แล้ว พร้อมเขียนลง database ตรงๆ</summary>
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

    /// <summary>
    /// ตรวจ body ของ POST/PUT ชุดเดียวกัน — คืน null = ผ่าน, คืน ActionResult = ตอบกลับไปเลย
    /// (สองเส้นนั้นรับ body หน้าตาเดียวกัน กติกาต้องเหมือนกันเป๊ะ เลยรวมไว้ที่เดียว)
    /// </summary>
    private ActionResult? Validate(CreateChangeRequestInput body, CurrentUser user, out ValidatedInput input)
    {
        input = null!;

        // เช็คก่อนแตะ database เลย ประหยัด query ที่ไม่จำเป็น
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

        // ยาวเกินความกว้างของ column -> SQL Server ปฏิเสธทั้งคำสั่ง (error 8152) กลายเป็น 500
        // ทั้งที่เป็นความผิดของข้อมูลขาเข้า — เช็คเองก่อนแล้วบอกไปเลยว่าช่องไหน
        // (ตัวเลขตรงกับ database/00_full_schema.sql)
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

        // ส่วน "3. การประเมินผลกระทบและทรัพยากร" (impact/changeTypes/downtime/duration/deployDate)
        // เฉพาะสิทธิ์ it_admin — frontend disable field พวกนี้ให้ role อื่นอยู่แล้ว แต่เชื่อ frontend
        // ไม่ได้ (ใครก็ยิง API ตรงๆ ข้าม UI ได้) role อื่นส่งอะไรมาก็ทิ้ง ใช้ค่า default แทน
        var isItAdmin = user.Role == "it_admin";

        var impact = isItAdmin && !string.IsNullOrWhiteSpace(body.Impact) ? body.Impact : "none";
        if (!AllowedImpacts.Contains(impact))
        {
            return BadRequest(new ErrorResponse($"impact ต้องเป็น {string.Join("/", AllowedImpacts)}"));
        }

        // Distinct: ติ๊ก checkbox เดิมซ้ำ (หรือยิง API ส่งค่าซ้ำมา) ไม่ควรได้ 2 แถวเหมือนกัน
        // ในตาราง cr_change_types (ไม่มี unique constraint กันไว้)
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
            // ค่าอื่นนอกจาก "draft" ถือเป็น submit ทันที
            Status: body.Status == "draft" ? "draft" : "submitted");

        return null;
    }

    /// <summary>เจ้าของใบเท่านั้น (it_admin ผ่านหมด) — คืน null = ผ่าน</summary>
    private ActionResult? CheckOwnership(EditTargetRow cr, CurrentUser user)
        => user.Role == "it_admin" || cr.RequesterId == user.UserId
            ? null
            : StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("Forbidden: ไม่ใช่ CR ของคุณ"));

    /// <summary>ลบแถวลูกทั้ง 3 ตารางแล้วใส่ชุดใหม่ (ใช้ร่วมทั้งตอนสร้างและตอนแก้ไข)</summary>
    private static async Task ReplaceChildRowsAsync(
        SqlConnection db, SqlTransaction tx, int crId,
        List<string> changeTypes, List<PlanRowInput>? plan, List<PlanRowInput>? rollbackPlan)
    {
        // ตอน POST ยังไม่มีแถวลูก DELETE เลยไม่โดนอะไร — ตอน PUT คือการล้างชุดเก่าทิ้ง
        await db.ExecuteAsync(
            """
            DELETE FROM cr_change_types   WHERE cr_id = @CrId;
            DELETE FROM cr_action_plans   WHERE cr_id = @CrId;
            DELETE FROM cr_rollback_plans WHERE cr_id = @CrId;
            """,
            new { CrId = crId }, tx);

        // checkbox "ประเภทการเปลี่ยน" ติ๊กได้หลายอัน -> 1 ประเภท = 1 แถว
        // Dapper ยิง INSERT ซ้ำให้เองเมื่อ parameter เป็น list
        if (changeTypes.Count > 0)
        {
            await db.ExecuteAsync(
                "INSERT INTO cr_change_types (cr_id, change_type) VALUES (@CrId, @ChangeType)",
                changeTypes.Select(t => new { CrId = crId, ChangeType = t }),
                tx);
        }

        // ตารางแผนงาน + แผนกู้คืน โครงเหมือนกันเป๊ะ ต่างแค่ชื่อตาราง
        // seq_no นับแยกชุดของตัวเอง เริ่ม 1 ใหม่ทั้งคู่
        await InsertPlanRowsAsync(db, tx, "cr_action_plans", crId, plan);
        await InsertPlanRowsAsync(db, tx, "cr_rollback_plans", crId, rollbackPlan);
    }

    /// <summary>ทำให้ % _ [ ที่ผู้ใช้พิมพ์เป็นตัวอักษรธรรมดา ไม่ใช่ wildcard ของ LIKE</summary>
    private static string EscapeLike(string value) => value
        .Replace(@"\", @"\\")
        .Replace("%", @"\%")
        .Replace("_", @"\_")
        .Replace("[", @"\[");

    private static string FormatCrNumber(int crId) => $"CR{crId:D7}";

    private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;

    /// <summary>ชื่อช่องแรกที่ยาวเกินกำหนด (null = ผ่านหมด)</summary>
    private static string? FirstTooLong(params (string Field, string? Value, int Max)[] fields)
    {
        foreach (var (field, value, max) in fields)
        {
            if (value?.Length > max) return $"{field} ยาวเกิน {max} ตัวอักษร";
        }
        return null;
    }

    /// <summary>
    /// ว่าง/ไม่ได้ส่งมา = null (ไม่ใช่ error) — ช่องวันที่ในฟอร์มไม่ required ทุกช่อง
    /// ส่งมาแต่แปลงไม่ได้ = false ให้ผู้เรียกตอบ 400
    /// </summary>
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

        // ฟอร์มมีแถวเปล่าติดมาด้วยเสมอ (กด "เพิ่มแถว" แล้วไม่กรอก / แถว default ตอนเปิดหน้า)
        // เดิม insert ลงไปหมดกลายเป็นแถวขยะใน database — ทิ้งแถวที่ไม่มีข้อมูลเลยตรงนี้
        var filled = rows.Where(row =>
            !string.IsNullOrWhiteSpace(row.Step) ||
            !string.IsNullOrWhiteSpace(row.Start) ||
            !string.IsNullOrWhiteSpace(row.End) ||
            !string.IsNullOrWhiteSpace(row.Owner) ||
            !string.IsNullOrWhiteSpace(row.Note)).ToList();

        if (filled.Count == 0) return;

        // seq_no นับเฉพาะแถวที่เก็บจริง — เลขจะได้เรียง 1,2,3 ไม่กระโดดข้ามแถวที่ทิ้งไป
        var seq = 1;
        var values = filled.Select(row => new
        {
            CrId = crId,
            SeqNo = seq++,
            Step = row.Step ?? "",   // step เป็น NOT NULL — ฟอร์มปล่อยว่างได้ เก็บเป็นข้อความว่าง
            StartDate = NullIfBlank(row.Start),
            EndDate = NullIfBlank(row.End),
            Owner = NullIfBlank(row.Owner),
            Note = NullIfBlank(row.Note)
        }).ToList();

        // ชื่อตารางมาจากค่าคงที่ในโค้ดนี้เท่านั้น (ไม่ใช่ input ผู้ใช้) — ต่อ string ได้ปลอดภัย
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

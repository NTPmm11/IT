using ChangeRequest.Api.Data;
using ChangeRequest.Api.Models;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace ChangeRequest.Api.Controllers;

// ============================================
// SystemsController — GET /api/systems (dropdown ในฟอร์ม)
// ============================================
//
// frontend/src/views/FormView.vue เรียกตอน mounted() เอาไปวาด <select id="cr-system">
// ไม่ต้อง login ก็เรียกได้ (ไม่มี [RequireAuth]) เหมือนของเดิม

[ApiController]
[Route("api/systems")]
[Tags("Systems")]
public sealed class SystemsController(ISqlConnectionFactory connections) : ControllerBase
{
    /// <summary>รายชื่อระบบ (สำหรับ dropdown)</summary>
    /// <response code="200">รายการระบบที่ยังเปิดใช้งาน</response>
    [HttpGet]
    [ProducesResponseType<IEnumerable<SystemDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        await using var db = await connections.OpenAsync(ct);
        // is_active = 1 = เฉพาะระบบที่ยังเปิดใช้งาน (ไม่โชว์ระบบที่ปิดไปแล้ว)
        var systems = await db.QueryAsync<SystemDto>(
            "SELECT system_code, system_name FROM systems WHERE is_active = 1 ORDER BY system_name");

        return Ok(systems);
    }
}

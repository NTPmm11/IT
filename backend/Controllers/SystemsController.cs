using ChangeRequest.Api.Data;
using ChangeRequest.Api.Models;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace ChangeRequest.Api.Controllers;

[ApiController]
[Route("api/systems")]
[Tags("Systems")]
public sealed class SystemsController(ISqlConnectionFactory connections) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<IEnumerable<SystemDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        await using var db = await connections.OpenAsync(ct);
        var systems = await db.QueryAsync<SystemDto>(
            "SELECT system_code, system_name FROM systems WHERE is_active = 1 ORDER BY system_name");

        return Ok(systems);
    }
}

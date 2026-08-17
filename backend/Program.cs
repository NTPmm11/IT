using System.Text.Encodings.Web;
using System.Text.Unicode;
using System.Threading.RateLimiting;
using ChangeRequest.Api.Configuration;
using ChangeRequest.Api.Data;
using ChangeRequest.Api.Models;
using ChangeRequest.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

// ============================================
// Program.cs — จุดเริ่มของ backend (ASP.NET Core)
// ============================================
//
// รัน: dotnet run  (ต้องมีไฟล์ .env ก่อน — copy จาก .env.example)
// API ทั้งหมดอยู่ใต้ /api/*  frontend ยิงมาที่ http://localhost:4000
// API docs: http://localhost:4000/api-docs
//
// ── ไฟล์นี้ผูกอะไรไว้บ้าง ──
//   Controllers/AuthController.cs            -> /api/auth/login
//   Controllers/SystemsController.cs         -> /api/systems
//   Controllers/ChangeRequestsController.cs  -> /api/change-requests/...
// ฝั่ง frontend (frontend/src/services/api.js) ยิง fetch มาที่ URL เหล่านี้โดยตรง

// dotnet run -- hash 1234   = พิมพ์ bcrypt hash ของรหัสผ่านออกมาแล้วจบ
// (เอาไปใส่ users.password_hash — แทน scripts/hash-password.js ของเดิม)
if (args is ["hash", var plainPassword, ..])
{
    Console.WriteLine(BCrypt.Net.BCrypt.HashPassword(plainPassword));
    return;
}

// .env ต้องโหลดก่อนสร้าง builder — configuration อ่าน environment variables ตอนนั้นเลย
DotEnv.Load(Path.Combine(Directory.GetCurrentDirectory(), ".env"));

var builder = WebApplication.CreateBuilder(args);

// Dapper map column แบบ snake_case -> property แบบ PascalCase ให้ (cr_number -> CrNumber)
DefaultTypeMap.MatchNamesWithUnderscores = true;

// ── บริการที่ inject เข้า controller ได้ ──
builder.Services.AddSingleton<ISqlConnectionFactory>(
    _ => new SqlConnectionFactory(SqlConnectionFactory.BuildConnectionString(builder.Configuration)));
builder.Services.AddSingleton<IMailService, MailService>();

// ── JWT: ตรวจลายเซ็น/วันหมดอายุของ token ให้ทุก request ──
// ผ่านแล้วยัด claims ใส่ HttpContext.User ให้ [RequireAuth] เอาไปใช้ต่อ
// (middleware นี้ไม่ปฏิเสธ request เอง — แค่ "อ่านป้ายชื่อ" ให้ ใครบังคับว่าต้องมีป้าย
//  คือ [RequireAuth] ที่แปะไว้ทีละ action)
var jwtOptions = JwtOptions.FromConfiguration(builder.Configuration);
builder.Services.AddSingleton(jwtOptions);
builder.Services.AddSingleton<ITokenService, TokenService>();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // false = ไม่แปลงชื่อ claim มาตรฐาน (sub) เป็น URI ยาวๆ ของ Microsoft
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = jwtOptions.SigningKey,
            ValidateLifetime = true,
            // default คือ 5 นาที — กว้างเกินไปสำหรับ token อายุไม่กี่ชั่วโมง
            ClockSkew = TimeSpan.FromSeconds(30),
            RoleClaimType = "role"
        };
    });
builder.Services.AddAuthorization();

// ── กันเดารหัสผ่านรัวๆ ที่ /api/auth/login ──
// นับแยกตาม IP ต้นทาง (ไม่ใช่นับรวมทั้งระบบ ไม่งั้นคนหนึ่งยิงรัวแล้วคนอื่น login ไม่ได้ตาม)
// QueueLimit = 0: เกินโควตาแล้วตอบ 429 ทันที ไม่ให้รอคิว
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy(RateLimitPolicies.Login, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = int.TryParse(builder.Configuration["LOGIN_RATE_LIMIT"], out var limit) && limit > 0
                    ? limit
                    : 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new ErrorResponse("พยายาม login บ่อยเกินไป รออีกสักครู่แล้วลองใหม่"), token);
    };
});

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        // ค่า default (camelCase) ตรงกับที่ frontend รออยู่แล้วสำหรับ key อย่าง crId/crNumber/ok
        // ส่วน key ที่เป็นชื่อ column ตรงๆ (cr_number, request_date) ล็อกไว้ด้วย
        // [JsonPropertyName] ใน Models/Dtos.cs
        //
        // encoder: ปล่อยตัวอักษรไทยเป็นตัวจริงในผลลัพธ์ ไม่แปลงเป็น \uXXXX
        options.JsonSerializerOptions.Encoder = JavaScriptEncoder.Create(UnicodeRanges.All);
    });

// [ApiController] ตอบ error รูปแบบ ProblemDetails มาให้เอง แต่ frontend อ่าน data.error
// (services/api.js) — เปลี่ยนให้ตอบรูปแบบเดียวกับ error อื่นทั้งระบบ
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    // การ validate ของโปรเจกต์นี้เขียนเองใน controller ทั้งหมด — ที่ตกมาถึงตรงนี้คือ
    // body แปลง JSON ไม่ผ่านเท่านั้น ตอบข้อความกลางๆ ไม่โยนรายละเอียด parser ให้คนนอก
    options.InvalidModelStateResponseFactory =
        _ => new BadRequestObjectResult(new ErrorResponse("Invalid request body"));
});

// ปกติ browser ห้ามเว็บ port นึงยิงหา server อีก port นึง — server ต้องประกาศเองว่ารับ
// (ไม่เปิดรับทุก origin เพราะ auth ของโปรเจกต์นี้พิสูจน์ตัวตนแค่ header X-User-Id)
var frontendUrl = builder.Configuration["FRONTEND_URL"] ?? "http://localhost:5173";
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy
        .WithOrigins(frontendUrl)
        .AllowAnyHeader()
        .AllowAnyMethod()
        // header ที่ไม่ใช่ชุดมาตรฐานต้องประกาศ ไม่งั้น JS ฝั่งเว็บอ่านไม่เห็น
        // (หน้ารายการใช้ค่านี้คำนวณจำนวนหน้า)
        .WithExposedHeaders("X-Total-Count"));
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "IT Change Request API",
        Version = "1.0.0",
        Description = "REST API for IT Change Request (CR) system"
    });

    // ปุ่ม Authorize ใน Swagger UI: วาง token ที่ได้จาก POST /api/auth/login
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT ที่ได้จาก POST /api/auth/login (ใส่เฉพาะตัว token ไม่ต้องพิมพ์ Bearer นำ)"
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
        }] = []
    });

    // <summary>/<response> เหนือ action -> คำอธิบายใน Swagger (แทนคอมเมนต์ @openapi เดิม)
    var xmlPath = Path.Combine(AppContext.BaseDirectory, $"{typeof(Program).Assembly.GetName().Name}.xml");
    if (File.Exists(xmlPath)) options.IncludeXmlComments(xmlPath);
});

// PORT ตัวเดิมใน .env (Express อ่าน process.env.PORT) — ตั้ง URL ให้ Kestrel ตรงกัน
// HOST: 0.0.0.0 = รับจากทุก network interface เหมือน app.listen(PORT) ของ Express
// (เปิดหน้าเว็บจากมือถือ/เครื่องอื่นในวงแลนแล้วยิง API เข้าเครื่องนี้ได้)
// อยากให้รับเฉพาะเครื่องตัวเองตั้ง HOST=localhost
var port = builder.Configuration["PORT"] ?? "4000";
var host = builder.Configuration["HOST"] ?? "0.0.0.0";
builder.WebHost.UseUrls($"http://{host}:{port}");

var app = builder.Build();

// error handler กลาง — exception ที่หลุดมาจาก controller ตกลงมาที่นี่
// log เต็มๆ ไว้อ่านเอง แต่ตอบ client แบบกลางๆ ไม่ส่งรายละเอียดให้คนนอกเห็น
app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    var feature = context.Features.Get<IExceptionHandlerFeature>();
    app.Logger.LogError(feature?.Error, "Unhandled exception");

    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    context.Response.ContentType = "application/json";
    await context.Response.WriteAsJsonAsync(new ErrorResponse("Internal server error"));
}));

app.UseCors();

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "IT Change Request API v1");
    options.RoutePrefix = "api-docs";   // เปิดที่ http://localhost:4000/api-docs
});

app.MapControllers();

// เช็คว่า server ยังทำงาน: เปิด GET /api/health ใน browser
app.MapGet("/api/health", () => Results.Json(new { ok = true }));

// URL ที่ไม่ตรงกับ route ไหนเลย — ตอบ JSON รูปแบบเดียวกับ error อื่น
// (ของเดิมตอบหน้า HTML ของ Express ทำให้ฝั่ง frontend อ่าน data.error ไม่ได้)
app.MapFallback(() => Results.Json(new ErrorResponse("Not found"), statusCode: StatusCodes.Status404NotFound));

if (jwtOptions.StartupWarning is not null) app.Logger.LogWarning("[auth] {Warning}", jwtOptions.StartupWarning);
app.Logger.LogInformation("API server running at http://localhost:{Port}", port);
app.Run();

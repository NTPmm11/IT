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

DotEnv.Load(Path.Combine(Directory.GetCurrentDirectory(), ".env"));
DotEnv.Load(Path.Combine(AppContext.BaseDirectory, ".env"));

var builder = WebApplication.CreateBuilder(args);

DefaultTypeMap.MatchNamesWithUnderscores = true;

builder.Services.AddSingleton<ISqlConnectionFactory>(
    _ => new SqlConnectionFactory(SqlConnectionFactory.BuildConnectionString(builder.Configuration)));
builder.Services.AddSingleton<IMailService, MailService>();

// ระบบนี้ไม่ได้ออก token เอง — password ส่งไปตรวจที่ SSO ของ ONEE แล้วรับ token ของ SSO มาใช้ต่อ
// (แพทเทิร์นเดียวกับ ONEE-Library / ONEE-ESS) role ยังอ่านจากตาราง users ของระบบนี้เหมือนเดิม
var ssoOptions = SsoOptions.FromConfiguration(builder.Configuration);
builder.Services.AddSingleton(ssoOptions);
builder.Services.AddSingleton<ISsoService, SsoService>();
builder.Services.AddHttpClient(SsoOptions.HttpClientName)
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        // SSO อยู่บน IP ภายในและใช้ cert ที่เซ็นเอง — ตั้ง SSO_VERIFY_CERT=true เมื่อมี cert จริง
        ServerCertificateCustomValidationCallback = ssoOptions.AcceptAnyCertificate
            ? HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
            : null
    });

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = ssoOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = ssoOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = ssoOptions.SigningKey,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            RoleClaimType = "role"
        };
    });
builder.Services.AddAuthorization();

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
        options.JsonSerializerOptions.Encoder = JavaScriptEncoder.Create(UnicodeRanges.All);
    });

builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory =
        _ => new BadRequestObjectResult(new ErrorResponse("Invalid request body"));
});

var frontendUrl = builder.Configuration["FRONTEND_URL"] ?? "http://localhost:5173";
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy
        .WithOrigins(frontendUrl)
        .AllowAnyHeader()
        .AllowAnyMethod()
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

    var xmlPath = Path.Combine(AppContext.BaseDirectory, $"{typeof(Program).Assembly.GetName().Name}.xml");
    if (File.Exists(xmlPath)) options.IncludeXmlComments(xmlPath);
});

var port = builder.Configuration["PORT"] ?? "4000";
var host = builder.Configuration["HOST"] ?? "0.0.0.0";
builder.WebHost.UseUrls($"http://{host}:{port}");

var app = builder.Build();

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
    options.RoutePrefix = "api-docs";
    options.DefaultModelsExpandDepth(-1);
});

app.MapControllers();

app.MapGet("/api/health", () => Results.Json(new { ok = true }));

app.MapFallback(() => Results.Json(new ErrorResponse("Not found"), statusCode: StatusCodes.Status404NotFound));

if (ssoOptions.StartupWarning is not null) app.Logger.LogWarning("[auth] {Warning}", ssoOptions.StartupWarning);
app.Logger.LogInformation("[auth] ตรวจ password ผ่าน SSO {BaseUrl}{TokenPath}", ssoOptions.BaseUrl, ssoOptions.TokenPath);
app.Logger.LogInformation("API server running at http://localhost:{Port}", port);
app.Run();

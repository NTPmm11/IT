using Microsoft.Data.SqlClient;

namespace ChangeRequest.Api.Data;

// ============================================
// SqlConnectionFactory — ตัวเปิด connection ไป SQL Server
// ============================================
//
// ADO.NET ทำ connection pooling ให้เองอยู่แล้วเบื้องหลัง (คุมด้วย Max Pool Size
// ใน connection string) — ที่นี่แค่เปิด SqlConnection ใหม่แล้ว using ทิ้งทุกครั้ง
// "ทิ้ง" = คืนเข้า pool ไม่ใช่ปิดจริง เลยไม่ต้องมี pool ที่เขียนเอง
//
// ใครใช้: Controllers ทุกตัว (ผ่าน Dapper) + Filters/RequireAuthFilter

public interface ISqlConnectionFactory
{
    Task<SqlConnection> OpenAsync(CancellationToken ct = default);
}

public sealed class SqlConnectionFactory(string connectionString) : ISqlConnectionFactory
{
    public async Task<SqlConnection> OpenAsync(CancellationToken ct = default)
    {
        var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);
        return connection;
    }

    /// <summary>
    /// ประกอบ connection string จากตัวแปรชุดเดิมใน .env (DB_HOST/DB_PORT/DB_USER/...)
    /// ถ้าตั้ง ConnectionStrings:Default ใน appsettings ไว้ ตัวนั้นชนะ
    /// </summary>
    public static string BuildConnectionString(IConfiguration config)
    {
        var explicitConnection = config.GetConnectionString("Default");
        if (!string.IsNullOrWhiteSpace(explicitConnection)) return explicitConnection;

        var builder = new SqlConnectionStringBuilder
        {
            DataSource = $"{config["DB_HOST"] ?? "localhost"},{config["DB_PORT"] ?? "1433"}",
            UserID = config["DB_USER"] ?? "sa",
            Password = config["DB_PASSWORD"] ?? "",
            InitialCatalog = config["DB_NAME"] ?? "CR",
            // local dev: ไม่ใช่ Azure และ cert ไม่ผ่าน CA ปกติ (ตรงกับ options ของ mssql เดิม)
            Encrypt = false,
            TrustServerCertificate = true,
            MaxPoolSize = 10,
            ConnectTimeout = 15
        };
        return builder.ConnectionString;
    }
}

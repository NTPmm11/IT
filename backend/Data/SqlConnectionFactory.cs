using Microsoft.Data.SqlClient;

namespace ChangeRequest.Api.Data;

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
            Encrypt = false,
            TrustServerCertificate = true,
            MaxPoolSize = 10,
            ConnectTimeout = 15
        };
        return builder.ConnectionString;
    }
}

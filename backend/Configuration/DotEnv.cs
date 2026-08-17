namespace ChangeRequest.Api.Configuration;

// ============================================
// DotEnv.cs — อ่านไฟล์ .env เข้า environment variables
// ============================================
//
// .NET ไม่มี dotenv ในตัวเหมือน Node แต่โปรเจกต์นี้มี backend/.env อยู่แล้ว
// (DB_HOST, SMTP_*, FRONTEND_URL) เลยอ่านเองตอนสตาร์ท เพื่อให้ไฟล์ .env เดิม
// ใช้ต่อได้โดยไม่ต้องย้ายค่าไป appsettings.json
//
// ลำดับความสำคัญ: environment variable ที่ตั้งไว้แล้วชนะ .env เสมอ
// (ตั้งค่าตอน deploy ทับไฟล์ในเครื่อง dev ได้)
public static class DotEnv
{
    public static void Load(string path)
    {
        if (!File.Exists(path)) return;

        foreach (var raw in File.ReadAllLines(path))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;

            var eq = line.IndexOf('=');
            if (eq <= 0) continue;

            var key = line[..eq].Trim();
            var value = line[(eq + 1)..].Trim();

            // ค่าที่ครอบด้วย " หรือ ' ให้ปอกออก
            if (value.Length >= 2 &&
                ((value[0] == '"' && value[^1] == '"') || (value[0] == '\'' && value[^1] == '\'')))
            {
                value = value[1..^1];
            }

            if (Environment.GetEnvironmentVariable(key) is null)
            {
                Environment.SetEnvironmentVariable(key, value);
            }
        }
    }
}

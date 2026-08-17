# backend — IT Change Request API (ASP.NET Core 8)

REST API ของระบบ Change Request — เดิมเป็น Node.js + Express ตอนนี้เป็น C# / .NET 8
(รูป JSON ทุกเส้นเหมือนเดิมเป๊ะ frontend ไม่ต้องแก้อะไร)

## รัน

```bash
cd backend
cp .env.example .env      # ครั้งแรก แล้วแก้ค่าให้ตรงเครื่องตัวเอง
dotnet run                # -> http://localhost:4000
```

- API docs (Swagger): <http://localhost:4000/api-docs>
- health check: <http://localhost:4000/api/health>

สร้าง bcrypt hash สำหรับใส่ `users.password_hash`:

```bash
dotnet run -- hash 1234
```

## ค่าใน .env

| ตัวแปร | ใช้ทำอะไร | ไม่ตั้งแล้วเป็นยังไง |
|---|---|---|
| `PORT` | port ที่ API ฟัง | 4000 |
| `HOST` | interface ที่รับ request (`localhost` = เฉพาะเครื่องตัวเอง) | `0.0.0.0` — เครื่องอื่นในวงแลนเรียกได้ |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | ที่อยู่ SQL Server | localhost,1433 / sa / (ว่าง) / CR |
| `FRONTEND_URL` | origin ที่ CORS ยอมรับ + ลิงก์ในอีเมล | <http://localhost:5173> |
| `JWT_SECRET` | กุญแจเซ็น token (`openssl rand -base64 48`) | สุ่มใหม่ทุกครั้งที่ restart — ต้อง login ใหม่ทุกรอบ |
| `JWT_ISSUER` / `JWT_AUDIENCE` | ค่าใน token ที่ต้องตรงกันตอนตรวจ | `cr-system` |
| `JWT_EXPIRES_HOURS` | token อายุกี่ชั่วโมง | 8 |
| `LOGIN_RATE_LIMIT` | login ได้กี่ครั้ง/นาที/IP (เกินแล้ว 429) | 10 |
| `ALLOW_SELF_APPROVAL` | `true` = อนุมัติคำขอที่ตัวเองยื่นได้ | ห้าม |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | SMTP ที่ใช้ส่งอีเมลจริง | **ไม่ส่งออก** — เขียนไฟล์ `.eml` ลง `bin/.../MailDrop/` แทน |
| `MAIL_FROM` / `MAIL_FROM_NAME` | ผู้ส่งที่โผล่ในอีเมล | `SMTP_USER` / "CR System" |

ตั้ง `ConnectionStrings:Default` ใน `appsettings.json` ได้ด้วย — ตั้งแล้วชนะ `DB_*` ทั้งหมด

## โครงไฟล์

```
backend/
├── Program.cs                     สตาร์ท server, CORS, Swagger, error handler กลาง
├── Configuration/DotEnv.cs        อ่าน .env เข้า environment variables
├── Data/SqlConnectionFactory.cs   เปิด connection ไป SQL Server (ADO.NET pool ในตัว)
├── Filters/
│   ├── RequireAuthAttribute.cs    ด่านเช็ค JWT + หา user จริงใน database
│   └── RequireRoleAttribute.cs    ด่านเช็ค role
├── Models/Dtos.cs                 รูป JSON ขาเข้า/ขาออก (ล็อกชื่อ key ด้วย JsonPropertyName)
├── Services/
│   ├── TokenService.cs            ออก JWT + อ่านค่า JWT_* จาก .env
│   ├── MailService.cs             ส่งอีเมลผ่าน MailKit
│   └── EmailRenderer.cs           ประกอบ HTML ของอีเมล
└── Controllers/
    ├── AuthController.cs          POST /api/auth/login
    ├── SystemsController.cs       GET  /api/systems
    └── ChangeRequestsController.cs CRUD ใบ CR + approval
```

## API

| Method | Path | สิทธิ์ |
|---|---|---|
| POST | `/api/auth/login` | ไม่ต้อง login (จำกัด 10 ครั้ง/นาที/IP) |
| GET | `/api/systems` | ไม่ต้อง login |
| GET | `/api/change-requests` | login — requester เห็นเฉพาะใบของตัวเอง |
| GET | `/api/change-requests/next-number` | login |
| GET | `/api/change-requests/{id}` | login — requester เปิดได้เฉพาะใบของตัวเอง (ไม่งั้น 403) |
| POST | `/api/change-requests` | login |
| PUT | `/api/change-requests/{id}` | เจ้าของใบ หรือ it_admin — เฉพาะใบสถานะ `draft` |
| DELETE | `/api/change-requests/{id}` | เจ้าของใบ หรือ it_admin — เฉพาะใบสถานะ `draft` |
| POST | `/api/change-requests/{id}/approval` | approver / it_admin — เฉพาะใบสถานะ `submitted` / `more_info` และต้องไม่ใช่ใบที่ตัวเองยื่น |

### แบ่งหน้า

`GET /api/change-requests?page=1&pageSize=10` — ตัดหน้าที่ database (`OFFSET/FETCH`)
body ยังเป็น array ของเฉพาะหน้านั้น จำนวนทั้งหมดอยู่ใน header **`X-Total-Count`**
ไม่ส่ง `page`/`pageSize` = คืนทุกแถว (หน้าเว็บใช้ตอนสั่งพิมพ์ PDF ย้อนหลัง)

### เลขที่เอกสาร

ออกจาก `dbo.cr_number_seq` (SEQUENCE) ไม่ใช่ `cr_id` — `GET /next-number` อ่านตัวนับเดียวกัน
เลข preview จึงตรงกับเลขจริง แม้จะเคยมีใบถูกลบหรือ insert ที่ rollback ไป
**ต้องรัน `database/07_cr_number_sequence.sql` ก่อน** ไม่งั้น `/next-number` ตอบ 500 พร้อมบอกให้ไปรัน

## Auth

`POST /api/auth/login` ตอบ `{ user, token, expiresAt }` — แนบ token กลับมาทุก request:

```
Authorization: Bearer <token>
```

token เป็น JWT เซ็นด้วย `JWT_SECRET` (HMAC-SHA256) แก้ payload เองไม่ได้ ลายเซ็นพังทันที
`role` ที่ใช้ตัดสินสิทธิ์อ่านสดจากตาราง `users` ทุก request ไม่ได้เชื่อค่าใน token —
ปิดใช้งาน user (`is_active = 0`) หรือเปลี่ยน role แล้วมีผลทันที ไม่ต้องรอ token หมดอายุ

| สถานการณ์ | คำตอบ |
|---|---|
| ไม่แนบ header | 401 `Missing bearer token` |
| token เสีย/หมดอายุ | 401 `Invalid or expired token` |
| user ถูกลบ/ปิดใช้งาน | 401 `Unknown user` |
| role ไม่ถึง | 403 `Forbidden: insufficient role` |

## Dependencies

Dapper · Microsoft.Data.SqlClient · Swashbuckle.AspNetCore · MailKit/MimeKit · BCrypt.Net-Next ·
Microsoft.AspNetCore.Authentication.JwtBearer

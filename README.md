# ระบบ Change Request (CR)

ฟอร์มขอเปลี่ยนแปลงระบบงาน — โปรเจคหัดเขียน full-stack:
Vue 3 + Vite + Vue Router (หน้าบ้าน) / C# ASP.NET Core 8 + SQL Server (หลังบ้าน)

## 👉 เริ่มตรงไหน? อ่านตามลำดับนี้

| ลำดับ | ไฟล์ | อ่านเมื่อไหร่ |
|---|---|---|
| 1 | **`dev-guide.txt`** | **เริ่มที่นี่** — ไล่จากขั้นที่ 0 ลงมาทีละขั้น |
| 2 | `dev-guide.txt` ภาคพิเศษ 1 (Vue) | ตอนถึงขั้นที่ 5 ข้อ【4】 |
| 3 | `dev-guide.txt` ภาคพิเศษ 2 (Backend) | ผ่านบท Vue แล้ว — ตั้งค่า SQL Server + .env |
| 4 | **`LABS.txt`** | ตั้งค่า backend เสร็จ — โจทย์ฝึกเขียน API จริง 7 ข้อ |

> โปรเจคนี้เป็น "ชุดฝึก": โค้ด backend บน branch นี้ (`main`)
> เว้นว่างไว้ให้เติมตาม TODO — เฉลยฉบับเต็มอยู่ branch `solution`
> ```bash
> git diff main solution -- <ไฟล์>   # แอบดูเฉลยทีละไฟล์
> ```

## วิธีเปิดใช้งาน

ต้องเปิด 2 ฝั่ง (2 Terminal):

```bash
# Terminal 1 — หลังบ้าน (ครั้งแรกต้องตั้งค่าก่อน: dev-guide ภาคพิเศษ 2)
cd backend && dotnet run         # -> http://localhost:4000

# Terminal 2 — หน้าบ้าน
cd frontend && npm install && npm run dev   # -> เทอร์มินัลบอก URL (เช่น http://localhost:5173)
```

Login: user อยู่ในตาราง `users` ของ database (ตั้งรหัสตอน setup)
ต้องต่อ internet (ไอคอน Font Awesome โหลดจาก CDN — Vue เองติดตั้งอยู่ในเครื่องแล้ว)

*ยังไม่ได้ตั้ง backend? เปิดหน้าเว็บดูได้เลย — แต่ login จะไม่ผ่าน
(ยิง POST /api/auth/login จริงเสมอ ไม่มีโหมดปลอม/hardcode) ต้องตั้ง backend
+ database ให้เสร็จก่อน (dev-guide ภาคพิเศษ 2) ถึงจะ login ได้*

## โครงไฟล์

```
IT/
├── README.md          ไฟล์นี้ — ป้ายบอกทาง
├── dev-guide.txt      คู่มือหลัก อ่านอันนี้ก่อน
├── LABS.txt           โจทย์ฝึก backend 7 ข้อ
├── frontend/          หน้าบ้าน (Vite + Vue Router)
│   ├── index.html       จุดเข้าเว็บของ Vite
│   └── src/
│       ├── main.js        สั่ง Vue เริ่มทำงาน + ผูก router
│       ├── App.vue        เปลือกนอกสุด มีแค่ <router-view/>
│       ├── router/        กำหนดว่า path ไหนโชว์หน้าไหน
│       ├── views/         1 ไฟล์ = 1 หน้า (template+script+style รวมกัน)
│       │   ├── LoginView.vue     หน้า login          ← LAB 5
│       │   ├── HomeView.vue      หน้าหลักหลัง login (ทางแยก)
│       │   ├── FormView.vue      ฟอร์ม + action plan  ← LAB 6
│       │   ├── ListView.vue      ประวัติ/สืบค้น CR ทั้งหมด
│       │   └── ApproveView.vue   ผลอนุมัติ            ← LAB 7
│       ├── components/
│       │   ├── ApprovalSection.vue  ฟอร์มอนุมัติ (ใช้ใน FormView + ApproveView)
│       │   └── StatusModal.vue      modal แจ้งผลสำเร็จ/พลาด
│       ├── services/
│       │   ├── api.js            ที่อยู่ API + apiFetch (ตัวช่วยยิง API)
│       │   └── commonActions.js  method ใช้ร่วม — ยกเลิก, PDF
│       └── assets/
│           ├── css/              หน้าตา (base / login / form)
│           └── img/
├── backend/           หลังบ้าน (C# ASP.NET Core 8) — ดู backend/README.md
│   ├── .env             รหัส database เครื่องเรา (ห้าม commit)
│   ├── Program.cs         จุดสตาร์ท server (port 4000)
│   ├── Data/              ตัวต่อ SQL Server
│   ├── Filters/           ด่านเช็ค user + role   ← LAB 3
│   ├── Models/            รูป JSON ขาเข้า/ขาออก
│   ├── Services/          ส่งอีเมลแจ้งเตือน
│   └── Controllers/
│       ├── SystemsController.cs         dropdown ระบบ   ← LAB 1
│       ├── AuthController.cs            login           ← LAB 2
│       └── ChangeRequestsController.cs  CRUD ใบ CR      ← LAB 4
└── database/           พิมพ์เขียว database เต็ม (7 ตาราง, T-SQL) — รันเรียงเลขไฟล์
    ├── users_only.sql    table users — รันก่อนสุด (FK ไฟล์อื่นอ้างถึง)
    ├── 01_systems.sql    .. 06_cr_rollback_plans.sql (รันตามลำดับเลข ห้ามข้าม)
    ├── 07_cr_number_sequence.sql  ตัวแจกเลขที่เอกสาร (ต้องรัน ไม่งั้น /next-number พัง)
    └── ...
```

## ลำดับหน้า

```
                              ┌─ กรอก CR ใหม่ ─> FormView ──Submit CR──> ApprovalSection (ต่อท้ายฟอร์ม)
LoginView ──login ผ่าน──> HomeView ─┤
                              └─ ประวัติ ─────> ListView ──คลิกแถว──> ApproveView (?crId=...)
     │                                              │                       │
  POST /api/auth/login                    GET /change-requests    POST .../approval
     └───────────────────────── backend (port 4000) ── SQL Server ──────────┘
```

(สลับหน้าโดย Vue Router — ไม่ reload browser ทั้งหน้าเหมือนเว็บ .html แยกไฟล์แบบเดิม)

## อยากแก้อะไร แก้ที่ไฟล์ไหน

| อยากทำ | แก้ที่ |
|---|---|
| เปลี่ยนสี/ปุ่ม/พื้นหลัง ทุกหน้า | `frontend/src/assets/css/base.css` |
| เปลี่ยนหน้าตาฟอร์ม/ตาราง | `frontend/src/assets/css/form.css` |
| เพิ่มช่องกรอกใหม่ | `frontend/src/views/FormView.vue` (+ column ใน DB ถ้าจะเก็บจริง) |
| แก้ปุ่มร่วม (ยกเลิก / ร่าง / PDF) | `frontend/src/services/commonActions.js` |
| เพิ่ม/แก้ user ที่ login ได้ | ตาราง `users` ใน database |
| เพิ่มตัวเลือก dropdown ระบบงาน | ตาราง `systems` ใน database (`INSERT INTO systems ...`) |
| เพิ่มหน้าใหม่ | สร้างไฟล์ใน `src/views/` + เพิ่ม route ใน `src/router/index.js` |
| เพิ่ม API เส้นใหม่ | `backend/Controllers/` (ดู `SystemsController.cs` เป็นแบบ) |

## หมายเหตุ

- รหัสผ่านเช็คฝั่ง server ด้วย bcrypt hash — ห้ามเก็บรหัสดิบใน database
- login แล้วได้ JWT กลับมา เก็บใน `localStorage.token` แล้วแนบเป็น
  `Authorization: Bearer ...` ทุก request (`frontend/src/services/api.js`)
  — requester เห็นเฉพาะ CR ของตัวเอง
- `backend/.env` มีรหัสเครื่องเรา — อยู่ใน .gitignore แล้ว ห้าม commit
- backend คุย SQL Server ด้วย Dapper (เขียน SQL เอง ไม่ใช่ ORM) ผ่าน
  `backend/Data/SqlConnectionFactory.cs` — parameter ใช้ชื่อแบบ `@Name`
- `LABS.txt` กับ `dev-guide.txt` เขียนไว้ตอน backend ยังเป็น Node + Express
  โจทย์/แนวคิดยังใช้ได้ แต่ชื่อไฟล์กับโค้ดตัวอย่างในนั้นเป็นของเวอร์ชันเดิม
- ดูข้อมูลที่หน้าเว็บคุยกับ server: F12 -> แท็บ Network

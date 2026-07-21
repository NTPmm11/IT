# ระบบ Change Request (CR)

ฟอร์มขอเปลี่ยนแปลงระบบงาน — โปรเจคหัดเขียน full-stack:
Vue 3 + Vite + Vue Router (หน้าบ้าน) / Node.js + Express + SQL Server (หลังบ้าน)

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
cd backend && npm run dev        # -> http://localhost:4000

# Terminal 2 — หน้าบ้าน
cd frontend && npm install && npm run dev   # -> เทอร์มินัลบอก URL (เช่น http://localhost:5173)
```

Login: user อยู่ในตาราง `users` ของ database (ตั้งรหัสตอน setup)
ต้องต่อ internet (ไอคอน Font Awesome โหลดจาก CDN — Vue เองติดตั้งอยู่ในเครื่องแล้ว)

*ยังไม่ได้ตั้ง backend? เปิดหน้าเว็บดูได้เลย — จะอยู่ "โหมดปลอม"
(login แบบ hardcode admin/1234, Submit ไม่ลง database) จนกว่าจะทำ LAB เสร็จ*

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
│       │   ├── FormView.vue      ฟอร์ม + action plan  ← LAB 6
│       │   └── ApproveView.vue   ผลอนุมัติ            ← LAB 7
│       ├── services/
│       │   ├── api.js            ที่อยู่ API + apiFetch (ตัวช่วยยิง API)
│       │   └── commonActions.js  method ใช้ร่วม — ยกเลิก, ร่าง, PDF
│       └── assets/
│           ├── css/              หน้าตา (base / login / form)
│           └── img/
├── backend/           หลังบ้าน (Node + Express)
│   ├── .env             รหัส database เครื่องเรา (ห้าม commit)
│   ├── scripts/         hash-password.js — สร้าง hash รหัสผ่าน
│   └── src/
│       ├── index.js       จุดสตาร์ท server (port 4000)
│       ├── db.js          ตัวต่อ SQL Server (pool)
│       ├── middleware/    ด่านเช็ค user    ← LAB 3
│       └── routes/
│           ├── systems.js   dropdown ระบบ   ← LAB 1
│           ├── auth.js      login           ← LAB 2
│           └── cr.js        CRUD ใบ CR      ← LAB 4
└── database/
    ├── schema.sql        พิมพ์เขียว database เต็ม (6 ตาราง, T-SQL)
    └── users_only.sql    เฉพาะ table users — รันก่อนได้ถ้ายังไม่พร้อมทำ LAB 1/4
```

## ลำดับหน้า

```
LoginView ──login ผ่าน──> FormView ──Submit CR──> ApproveView (?crId=...)
     │                        │                          │
  POST /api/auth/login   POST /api/change-requests  POST .../approval
     └────────────── backend (port 4000) ── SQL Server ──┘
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
| เพิ่ม API เส้นใหม่ | `backend/src/routes/` (ดู `systems.js` เป็นแบบ) |

## หมายเหตุ

- รหัสผ่านเช็คฝั่ง server ด้วย bcrypt hash — ห้ามเก็บรหัสดิบใน database
- `backend/.env` มีรหัสเครื่องเรา — อยู่ใน .gitignore แล้ว ห้าม commit
- `backend/src/db.js` ห่อ driver `mssql` ให้หน้าตาเหมือน mysql2 (`pool.query`,
  `pool.getConnection()`, `?` placeholder) — TODO/hint ใน routes ไฟล์ต่างๆ
  เขียนโค้ดสไตล์นั้นได้ตรงๆ โดยไม่ต้องรู้ว่าเบื้องหลังเป็น SQL Server
- ดูข้อมูลที่หน้าเว็บคุยกับ server: F12 -> แท็บ Network

# Data Dictionary — IT Change Request (CR) System

Database: `CR` (SQL Server)
อ้างอิงจากไฟล์ schema จริงใน `database/` (`users_only.sql`, `01`-`06`, รวมเป็นไฟล์เดียวใน `00_full_schema.sql`)

## ภาพรวมความสัมพันธ์ (ER)

```
users ──< change_requests >── systems
              │
              ├──< cr_change_types
              ├──< cr_action_plans
              ├──< cr_rollback_plans
              └──< cr_approvals >── users (approver_id)
```

---

## 1. users

ผู้ใช้งานระบบ (requester / approver / it_admin)

| Column | Type | Null | Default | คำอธิบาย |
|---|---|---|---|---|
| user_id | INT IDENTITY(1,1) | NOT NULL | auto | PK |
| username | NVARCHAR(50) | NOT NULL | - | ใช้ login, UNIQUE |
| password_hash | NVARCHAR(255) | NOT NULL | - | bcrypt hash เท่านั้น ห้ามเก็บ plain text |
| full_name | NVARCHAR(100) | NOT NULL | - | ชื่อ-นามสกุล |
| email | NVARCHAR(100) | NULL | - | ใช้ส่งอีเมลแจ้งเตือน |
| department | NVARCHAR(100) | NULL | - | แผนก |
| role | NVARCHAR(20) | NOT NULL | `requester` | `requester` \| `it_admin` \| `approver` (CHECK) |
| is_active | BIT | NOT NULL | `1` | ปิดใช้งาน user โดยไม่ต้องลบแถว |
| created_at | DATETIME | NOT NULL | `GETDATE()` | |
| updated_at | DATETIME | NOT NULL | `GETDATE()` | |

**Key:** PK `user_id`, UNIQUE `username`

---

## 2. systems

รายชื่อระบบงาน (ใช้เป็น dropdown "ระบบที่เกี่ยวข้อง" ในฟอร์ม CR)

| Column | Type | Null | Default | คำอธิบาย |
|---|---|---|---|---|
| system_id | INT IDENTITY(1,1) | NOT NULL | auto | PK |
| system_code | NVARCHAR(20) | NOT NULL | - | รหัสระบบ เช่น `SRV`, `NET` — UNIQUE |
| system_name | NVARCHAR(100) | NOT NULL | - | ชื่อระบบเต็ม |
| is_active | BIT | NOT NULL | `1` | โชว์ใน dropdown เฉพาะ `1` |

**Key:** PK `system_id`, UNIQUE `system_code`

**ข้อมูลเริ่มต้น:** SRV (Server), NET (Network), DB (Database), APP (Application), UPS (UPS), BAK (Backup)

---

## 3. change_requests

ตารางหลักของใบ CR (ฟอร์ม section 1-3)

| Column | Type | Null | Default | คำอธิบาย |
|---|---|---|---|---|
| cr_id | INT IDENTITY(1,1) | NOT NULL | auto | PK |
| cr_number | NVARCHAR(30) | NOT NULL | - | เลขที่เอกสาร รูปแบบ `CR0000001` (สร้างจาก cr_id หลัง insert) — UNIQUE |
| request_date | DATE | NULL | - | วันที่ยื่นคำขอ |
| requester_id | INT | NOT NULL | - | FK → `users.user_id` (ผู้ยื่นคำขอ) |
| department | NVARCHAR(100) | NULL | - | แผนกผู้ยื่น |
| system_id | INT | NOT NULL | - | FK → `systems.system_id` |
| contact | NVARCHAR(100) | NULL | - | ช่องทางติดต่อผู้ยื่น |
| priority | NVARCHAR(10) | NOT NULL | `Low` | `Low` \| `Medium` \| `High` \| `Critical` (CHECK) |
| subject | NVARCHAR(255) | NOT NULL | - | เรื่อง |
| problem | NVARCHAR(MAX) | NULL | - | ปัญหา/ที่มา |
| request_detail | NVARCHAR(MAX) | NULL | - | รายละเอียดคำขอ |
| impact | NVARCHAR(10) | NOT NULL | `none` | `none` \| `other` (CHECK) |
| impact_detail | NVARCHAR(255) | NULL | - | รายละเอียดผลกระทบ (เมื่อ impact=`other`) |
| downtime | BIT | NOT NULL | `0` | ต้องหยุดระบบหรือไม่ |
| duration | NVARCHAR(50) | NULL | - | ระยะเวลาหยุดระบบ |
| deploy_date | DATE | NULL | - | วันที่จะ deploy |
| status | NVARCHAR(20) | NOT NULL | `submitted` | `draft` \| `submitted` \| `approved` \| `rejected` \| `more_info` (CHECK) |
| created_at | DATETIME | NOT NULL | `GETDATE()` | |
| updated_at | DATETIME | NOT NULL | `GETDATE()` | อัปเดตทุกครั้งที่มีผลพิจารณาใหม่ |

**Key:** PK `cr_id`, UNIQUE `cr_number`, FK `requester_id`→users, FK `system_id`→systems

⚠ **หมายเหตุ:** `status` ใช้ขีดล่าง (`more_info`) แต่ `cr_approvals.result` ใช้ขีดกลาง (`more-info`) — backend เป็นคนแปลงให้ตอน insert

---

## 4. cr_change_types

ประเภทการเปลี่ยนแปลง (checkbox หลายค่าต่อ 1 CR)

| Column | Type | Null | Default | คำอธิบาย |
|---|---|---|---|---|
| id | INT IDENTITY(1,1) | NOT NULL | auto | PK |
| cr_id | INT | NOT NULL | - | FK → `change_requests.cr_id`, ON DELETE CASCADE |
| change_type | NVARCHAR(20) | NOT NULL | - | `App` \| `DB` \| `Infra` (CHECK) |

**ความสัมพันธ์:** 1 CR : N แถว (1 แถวต่อ 1 ประเภทที่ติ๊ก)

---

## 5. cr_action_plans

แผนดำเนินงาน (section 4 ของฟอร์ม)

| Column | Type | Null | Default | คำอธิบาย |
|---|---|---|---|---|
| id | INT IDENTITY(1,1) | NOT NULL | auto | PK |
| cr_id | INT | NOT NULL | - | FK → `change_requests.cr_id`, ON DELETE CASCADE |
| seq_no | INT | NOT NULL | - | ลำดับขั้นตอน (1, 2, 3, ...) |
| step | NVARCHAR(255) | NOT NULL | - | รายละเอียดขั้นตอน |
| start_date | NVARCHAR(50) | NULL | - | ⚠ เก็บเป็นข้อความ (ไม่ใช่ DATE) เพราะฟอร์มส่งเวลา เช่น `"10:00"` |
| end_date | NVARCHAR(50) | NULL | - | เหมือน start_date |
| owner | NVARCHAR(100) | NULL | - | ผู้รับผิดชอบขั้นตอนนี้ |
| note | NVARCHAR(255) | NULL | - | หมายเหตุ |

**ความสัมพันธ์:** 1 CR : N แถว, เรียงตาม `seq_no`

---

## 6. cr_rollback_plans

แผนการกู้คืน (Roll Back Plan) — โครงสร้างเหมือน `cr_action_plans` ทุกอย่าง แยกคนละตาราง

| Column | Type | Null | Default | คำอธิบาย |
|---|---|---|---|---|
| id | INT IDENTITY(1,1) | NOT NULL | auto | PK |
| cr_id | INT | NOT NULL | - | FK → `change_requests.cr_id`, ON DELETE CASCADE |
| seq_no | INT | NOT NULL | - | ลำดับขั้นตอน (นับแยกจาก action plan) |
| step | NVARCHAR(255) | NOT NULL | - | รายละเอียดขั้นตอน |
| start_date | NVARCHAR(50) | NULL | - | เก็บเป็นข้อความเหมือน cr_action_plans |
| end_date | NVARCHAR(50) | NULL | - | |
| owner | NVARCHAR(100) | NULL | - | |
| note | NVARCHAR(255) | NULL | - | |

**ความสัมพันธ์:** 1 CR : N แถว, เรียงตาม `seq_no`

---

## 7. cr_approvals

ผลการพิจารณา (section 5 / approve.html) — 1 CR อาจมีได้หลายรอบพิจารณา (เช่นขอข้อมูลเพิ่มแล้วพิจารณาใหม่)

| Column | Type | Null | Default | คำอธิบาย |
|---|---|---|---|---|
| approval_id | INT IDENTITY(1,1) | NOT NULL | auto | PK |
| cr_id | INT | NOT NULL | - | FK → `change_requests.cr_id`, ON DELETE CASCADE |
| approver_id | INT | NOT NULL | - | FK → `users.user_id` (ผู้พิจารณา) |
| result | NVARCHAR(20) | NOT NULL | - | `approved` \| `rejected` \| `more-info` (CHECK, ขีดกลาง) |
| comment | NVARCHAR(MAX) | NULL | - | ความเห็นประกอบ |
| approval_date | DATE | NULL | - | วันที่พิจารณา |
| created_at | DATETIME | NOT NULL | `GETDATE()` | |

**ความสัมพันธ์:** 1 CR : N แถว (ประวัติการพิจารณาทุกรอบ), FK `approver_id`→users

---

## Enum / CHECK constraint สรุปรวม

| ตาราง.คอลัมน์ | ค่าที่ยอมรับ |
|---|---|
| `users.role` | `requester`, `it_admin`, `approver` |
| `change_requests.priority` | `Low`, `Medium`, `High`, `Critical` |
| `change_requests.impact` | `none`, `other` |
| `change_requests.status` | `draft`, `submitted`, `approved`, `rejected`, `more_info` |
| `cr_change_types.change_type` | `App`, `DB`, `Infra` |
| `cr_approvals.result` | `approved`, `rejected`, `more-info` |

## Endpoint ↔ ตารางที่แตะ

| Endpoint | ตารางที่เกี่ยวข้อง |
|---|---|
| `POST /api/auth/login` | `users` |
| `GET /api/systems` | `systems` |
| `GET /api/change-requests` | `change_requests`, `users`, `systems` |
| `GET /api/change-requests/:id` | `change_requests`, `users`, `systems`, `cr_change_types`, `cr_action_plans`, `cr_rollback_plans`, `cr_approvals` |
| `POST /api/change-requests` | `change_requests`, `cr_change_types`, `cr_action_plans`, `cr_rollback_plans` |
| `POST /api/change-requests/:id/approval` | `cr_approvals`, `change_requests` |

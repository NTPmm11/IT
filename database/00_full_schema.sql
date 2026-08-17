-- ============================================
-- 00_full_schema.sql — รวมทุกไฟล์ (users_only.sql + 01..06) เป็นไฟล์เดียว
-- SQL Server (T-SQL)
--
-- ใช้ตอนจำลอง database จากเครื่อง dev ไปสร้างบน server อื่น (SSMS / sqlcmd)
-- รันไฟล์นี้ไฟล์เดียวพอ ไม่ต้องรันทีละไฟล์ 7 รอบเหมือน dev-guide
-- (ลำดับตารางในนี้เรียงตาม FK ไว้แล้ว: users -> systems -> change_requests ->
--  cr_change_types -> cr_action_plans -> cr_approvals -> cr_rollback_plans)
--
-- ⚠ password_hash ของ users ด้านล่างเป็น placeholder ('$2y$10$REPLACE_WITH_REAL_HASH')
--    login ไม่ได้จนกว่าจะ UPDATE ด้วย bcrypt hash จริง เช่น:
--      node -e "console.log(require('bcryptjs').hashSync('1234', 10))"
--    แล้ว UPDATE users SET password_hash = '<hash ที่ได้>' WHERE username = 'admin';
-- ============================================

-- ── 0. สร้าง database (จาก users_only.sql) ──
IF DB_ID('CR') IS NULL
BEGIN
    CREATE DATABASE CR;
END
GO

USE CR;
GO

-- ── 1. users (จาก users_only.sql) ──
CREATE TABLE users (
  user_id       INT IDENTITY(1,1) PRIMARY KEY,
  username      NVARCHAR(50)  NOT NULL UNIQUE,
  password_hash NVARCHAR(255) NOT NULL,
  full_name     NVARCHAR(100) NOT NULL,
  email         NVARCHAR(100),
  department    NVARCHAR(100),
  role          NVARCHAR(20)  NOT NULL DEFAULT 'requester'
                CHECK (role IN ('requester','it_admin','approver')),
  is_active     BIT           NOT NULL DEFAULT 1,
  created_at    DATETIME      NOT NULL DEFAULT GETDATE(),
  updated_at    DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

INSERT INTO users (username, password_hash, full_name, email, department, role) VALUES
  (N'admin',     N'$2y$10$REPLACE_WITH_REAL_HASH', N'ผู้ดูแลระบบ',    N'pungzaza44@gmail.com', N'IT',        N'it_admin'),
  (N'somchai',   N'$2y$10$REPLACE_WITH_REAL_HASH', N'สมชาย ใจดี',     N'somchai@company.com',  N'Marketing', N'requester'),
  (N'approver1', N'$2y$10$REPLACE_WITH_REAL_HASH', N'หัวหน้าฝ่าย IT', N'approver@company.com', N'IT',        N'approver');
GO

-- ── 2. systems (จาก 01_systems.sql) ──
CREATE TABLE systems (
  system_id   INT IDENTITY(1,1) PRIMARY KEY,
  system_code NVARCHAR(20)  NOT NULL UNIQUE,
  system_name NVARCHAR(100) NOT NULL,
  is_active   BIT           NOT NULL DEFAULT 1
);
GO

INSERT INTO systems (system_code, system_name) VALUES
  (N'WEB',  N'Web Portal'),
  (N'ERP',  N'ERP System'),
  (N'CRM',  N'CRM System'),
  (N'HR',   N'HR Management'),
  (N'ACC',  N'Accounting System');
GO

-- ── 3. change_requests (จาก 02_change_requests.sql) ──
CREATE TABLE change_requests (
  cr_id          INT IDENTITY(1,1) PRIMARY KEY,
  cr_number      NVARCHAR(30)  NOT NULL UNIQUE,
  request_date   DATE          NULL,
  requester_id   INT           NOT NULL REFERENCES users(user_id),
  department     NVARCHAR(100) NULL,
  system_id      INT           NOT NULL REFERENCES systems(system_id),
  contact        NVARCHAR(100) NULL,
  priority       NVARCHAR(10)  NOT NULL DEFAULT 'Low'
                 CHECK (priority IN ('Low','Medium','High','Critical')),
  subject        NVARCHAR(255) NOT NULL,
  problem        NVARCHAR(MAX) NULL,
  request_detail NVARCHAR(MAX) NULL,
  impact         NVARCHAR(10)  NOT NULL DEFAULT 'none'
                 CHECK (impact IN ('none','other')),
  impact_detail  NVARCHAR(255) NULL,
  downtime       BIT           NOT NULL DEFAULT 0,
  duration       NVARCHAR(50)  NULL,
  deploy_date    DATE          NULL,
  status         NVARCHAR(20)  NOT NULL DEFAULT 'submitted'
                 CHECK (status IN ('draft','submitted','approved','rejected','more_info')),
  created_at     DATETIME      NOT NULL DEFAULT GETDATE(),
  updated_at     DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

-- ── 4. cr_change_types (จาก 03_cr_change_types.sql) ──
CREATE TABLE cr_change_types (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  cr_id       INT          NOT NULL REFERENCES change_requests(cr_id) ON DELETE CASCADE,
  change_type NVARCHAR(20) NOT NULL CHECK (change_type IN ('App','DB','Infra'))
);
GO

-- ── 5. cr_action_plans (จาก 04_cr_action_plans.sql) ──
CREATE TABLE cr_action_plans (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  cr_id      INT           NOT NULL REFERENCES change_requests(cr_id) ON DELETE CASCADE,
  seq_no     INT           NOT NULL,
  step       NVARCHAR(255) NOT NULL,
  start_date NVARCHAR(50)  NULL,
  end_date   NVARCHAR(50)  NULL,
  owner      NVARCHAR(100) NULL,
  note       NVARCHAR(255) NULL
);
GO

-- ── 6. cr_approvals (จาก 05_cr_approvals.sql) ──
CREATE TABLE cr_approvals (
  approval_id   INT IDENTITY(1,1) PRIMARY KEY,
  cr_id         INT           NOT NULL REFERENCES change_requests(cr_id) ON DELETE CASCADE,
  approver_id   INT           NOT NULL REFERENCES users(user_id),
  result        NVARCHAR(20)  NOT NULL CHECK (result IN ('approved','rejected','more-info')),
  comment       NVARCHAR(MAX) NULL,
  approval_date DATE          NULL,
  created_at    DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

-- ── 7. cr_rollback_plans (จาก 06_cr_rollback_plans.sql) ──
CREATE TABLE cr_rollback_plans (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  cr_id      INT           NOT NULL REFERENCES change_requests(cr_id) ON DELETE CASCADE,
  seq_no     INT           NOT NULL,
  step       NVARCHAR(255) NOT NULL,
  start_date NVARCHAR(50)  NULL,
  end_date   NVARCHAR(50)  NULL,
  owner      NVARCHAR(100) NULL,
  note       NVARCHAR(255) NULL
);
GO

-- ── 8. cr_number_seq (จาก 07_cr_number_sequence.sql) ──
-- ตัวแจกเลขที่เอกสาร — backend อ่านตัวนี้ทั้งตอน preview และตอนออกเลขจริง
-- (ไม่ผูกกับ cr_id อีกแล้ว เลยไม่เพี้ยนเวลามีแถวถูกลบ/insert ที่ rollback)
-- database ใหม่เริ่มที่ 0 แล้วกินทิ้ง 1 ค่า -> ใบแรกได้ CR0000001
CREATE SEQUENCE dbo.cr_number_seq AS INT START WITH 0 INCREMENT BY 1 NO CACHE;
GO

DECLARE @burn INT = NEXT VALUE FOR dbo.cr_number_seq;
GO

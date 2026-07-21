-- ============================================
-- schema.sql — IT Change Request (CR) System
-- SQL Server (T-SQL)
-- ============================================

IF DB_ID('CR') IS NULL
BEGIN
    CREATE DATABASE CR;
END
GO

USE CR;
GO

-- --------------------------------------------
-- 1. users — บัญชีผู้ใช้ (หน้า login)
-- --------------------------------------------
CREATE TABLE users (
  user_id       INT IDENTITY(1,1) PRIMARY KEY,
  username      NVARCHAR(50)  NOT NULL UNIQUE,
  password_hash NVARCHAR(255) NOT NULL,              -- เก็บ hash เท่านั้น ห้ามเก็บ plain text
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

-- --------------------------------------------
-- 2. systems — ระบบที่เกี่ยวข้อง (dropdown ใน form)
-- --------------------------------------------
CREATE TABLE systems (
  system_id   INT IDENTITY(1,1) PRIMARY KEY,
  system_code NVARCHAR(30)  NOT NULL UNIQUE,          -- เช่น web-portal, mobile-app, sap
  system_name NVARCHAR(100) NOT NULL,
  is_active   BIT           NOT NULL DEFAULT 1
);
GO

INSERT INTO systems (system_code, system_name) VALUES
  (N'web-portal', N'Web Portal Schema'),
  (N'mobile-app', N'Mobile Application'),
  (N'sap',        N'SAP / ERP System');
GO

-- --------------------------------------------
-- 3. change_requests — ฟอร์ม CR หลัก (section 1-3 ในหน้าฟอร์ม)
-- --------------------------------------------
CREATE TABLE change_requests (
  cr_id         INT IDENTITY(1,1) PRIMARY KEY,
  cr_number     NVARCHAR(20)  NOT NULL UNIQUE,        -- เลขที่เอกสาร เช่น CR6908001

  -- [1] ข้อมูลทั่วไป
  request_date  DATE          NOT NULL,
  requester_id  INT           NOT NULL,               -- FK -> users
  department    NVARCHAR(100),
  system_id     INT           NOT NULL,               -- FK -> systems
  contact       NVARCHAR(100),                        -- อีเมล/เบอร์โทร
  priority      NVARCHAR(10)  NOT NULL DEFAULT 'Low'
                CHECK (priority IN ('Low','Medium','High','Critical')),

  -- [2] รายละเอียดการขอเปลี่ยน
  subject        NVARCHAR(255) NOT NULL,
  problem        NVARCHAR(MAX),                       -- สถานะปัจจุบัน/ปัญหาที่พบ
  request_detail NVARCHAR(MAX),                       -- สิ่งที่ต้องการให้ปรับปรุง

  -- [3] การประเมินผลกระทบ (เฉพาะสิทธิ์ IT/Admin)
  impact        NVARCHAR(10)  NOT NULL DEFAULT 'none'
                CHECK (impact IN ('none','other')),
  impact_detail NVARCHAR(255),                        -- ระบุเมื่อ impact = 'other'
  downtime      BIT           NOT NULL DEFAULT 0,      -- ต้องปิดระบบชั่วคราว
  duration      NVARCHAR(50),                          -- ระยะเวลาที่คาดใช้ เช่น "2 วัน"
  deploy_date   DATE,                                  -- เป้าหมาย deploy

  -- สถานะเอกสาร
  status        NVARCHAR(15)  NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','submitted','approved','rejected','more_info')),

  created_at    DATETIME      NOT NULL DEFAULT GETDATE(),
  updated_at    DATETIME      NOT NULL DEFAULT GETDATE(),

  CONSTRAINT fk_cr_requester FOREIGN KEY (requester_id) REFERENCES users(user_id),
  CONSTRAINT fk_cr_system    FOREIGN KEY (system_id)    REFERENCES systems(system_id)
);
GO

CREATE INDEX idx_cr_status ON change_requests(status);
CREATE INDEX idx_cr_request_date ON change_requests(request_date);
GO

-- --------------------------------------------
-- 4. cr_change_types — ประเภทการเปลี่ยน (checkbox หลายค่า)
--    1 CR เลือกได้หลายประเภท -> แยกตาราง 1 แถวต่อ 1 ประเภท
-- --------------------------------------------
CREATE TABLE cr_change_types (
  cr_id       INT NOT NULL,
  change_type NVARCHAR(10) NOT NULL CHECK (change_type IN ('App','DB','Infra')),
  PRIMARY KEY (cr_id, change_type),
  CONSTRAINT fk_ct_cr FOREIGN KEY (cr_id)
    REFERENCES change_requests(cr_id) ON DELETE CASCADE
);
GO

-- --------------------------------------------
-- 5. cr_action_plans — แผนดำเนินงาน (section 4: ตาราง rows)
--    1 แถวในตาราง = 1 record
-- --------------------------------------------
CREATE TABLE cr_action_plans (
  plan_id    INT IDENTITY(1,1) PRIMARY KEY,
  cr_id      INT NOT NULL,
  seq_no     INT NOT NULL,                            -- ลำดับขั้นตอน
  step       NVARCHAR(255) NOT NULL,                  -- ขั้นตอนงาน
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  owner      NVARCHAR(100),                           -- ผู้รับผิดชอบ
  note       NVARCHAR(255),
  CONSTRAINT fk_plan_cr FOREIGN KEY (cr_id)
    REFERENCES change_requests(cr_id) ON DELETE CASCADE,
  CONSTRAINT uq_plan_seq UNIQUE (cr_id, seq_no)
);
GO

-- --------------------------------------------
-- 6. cr_approvals — ผลการพิจารณา (section 5: หน้าอนุมัติ)
-- --------------------------------------------
CREATE TABLE cr_approvals (
  approval_id   INT IDENTITY(1,1) PRIMARY KEY,
  cr_id         INT NOT NULL,
  approver_id   INT NOT NULL,                         -- FK -> users (role approver)
  result        NVARCHAR(15) NOT NULL
                CHECK (result IN ('approved','rejected','more-info')),
  comment       NVARCHAR(MAX),                        -- ความเห็นทีมพัฒนา/ผู้ประเมิน
  approval_date DATE NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT GETDATE(),
  CONSTRAINT fk_ap_cr       FOREIGN KEY (cr_id)       REFERENCES change_requests(cr_id) ON DELETE CASCADE,
  CONSTRAINT fk_ap_approver FOREIGN KEY (approver_id) REFERENCES users(user_id)
);
GO

-- --------------------------------------------
-- ข้อมูลตัวอย่าง (sample data)
-- N'...' = string เป็น Unicode (จำเป็นสำหรับภาษาไทยใน NVARCHAR)
-- --------------------------------------------
INSERT INTO users (username, password_hash, full_name, email, department, role) VALUES
  (N'admin',     N'$2y$10$REPLACE_WITH_REAL_HASH', N'ผู้ดูแลระบบ',    N'admin@company.com',    N'IT',        N'it_admin'),
  (N'somchai',   N'$2y$10$REPLACE_WITH_REAL_HASH', N'สมชาย ใจดี',     N'somchai@company.com',  N'Marketing', N'requester'),
  (N'approver1', N'$2y$10$REPLACE_WITH_REAL_HASH', N'หัวหน้าฝ่าย IT', N'approver@company.com', N'IT',        N'approver');
GO

-- ============================================
-- users_only.sql — เฉพาะของ login (users table)
-- SQL Server (T-SQL)
-- รันไฟล์นี้ก่อนได้ ค่อยเพิ่ม table อื่น (systems, change_requests, ...)
-- ทีหลังจาก schema.sql ตอนพร้อมทำ LAB ถัดไป
-- ============================================

IF DB_ID('CR') IS NULL
BEGIN
    CREATE DATABASE CR;
END
GO

USE CR;
GO

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

-- N'...' = string เป็น Unicode (จำเป็นสำหรับภาษาไทยใน NVARCHAR)
INSERT INTO users (username, password_hash, full_name, email, department, role) VALUES
  (N'admin',     N'$2y$10$REPLACE_WITH_REAL_HASH', N'ผู้ดูแลระบบ',    N'admin@company.com',    N'IT',        N'it_admin'),
  (N'somchai',   N'$2y$10$REPLACE_WITH_REAL_HASH', N'สมชาย ใจดี',     N'somchai@company.com',  N'Marketing', N'requester'),
  (N'approver1', N'$2y$10$REPLACE_WITH_REAL_HASH', N'หัวหน้าฝ่าย IT', N'approver@company.com', N'IT',        N'approver');
GO

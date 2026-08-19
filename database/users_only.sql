
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

INSERT INTO users (username, full_name, email, department, role) VALUES
  (N'admin',     N'ผู้ดูแลระบบ',    N'pungzaza44@gmail.com', N'IT',        N'it_admin'),
  (N'somchai',   N'สมชาย ใจดี',     N'somchai@company.com',  N'Marketing', N'requester'),
  (N'approver1', N'หัวหน้าฝ่าย IT', N'approver@company.com', N'IT',        N'approver');
GO

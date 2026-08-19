
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

CREATE TABLE cr_change_types (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  cr_id       INT          NOT NULL REFERENCES change_requests(cr_id) ON DELETE CASCADE,
  change_type NVARCHAR(20) NOT NULL CHECK (change_type IN ('App','DB','Infra'))
);
GO

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

CREATE SEQUENCE dbo.cr_number_seq AS INT START WITH 0 INCREMENT BY 1 NO CACHE;
GO

DECLARE @burn INT = NEXT VALUE FOR dbo.cr_number_seq;
GO

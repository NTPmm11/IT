-- ============================================
-- 02_change_requests.sql — ใบ CR หลัก (LAB 4B: POST /api/change-requests)
-- SQL Server (T-SQL)
-- รันหลัง 01_systems.sql (FK อ้าง users + systems)
-- ============================================

USE CR;
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
  -- more_info ใช้ขีดล่าง (ฝั่ง route แปลง more-info -> more_info ให้แล้ว)
  status         NVARCHAR(20)  NOT NULL DEFAULT 'submitted'
                 CHECK (status IN ('draft','submitted','approved','rejected','more_info')),
  created_at     DATETIME      NOT NULL DEFAULT GETDATE(),
  updated_at     DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

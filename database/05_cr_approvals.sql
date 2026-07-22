-- ============================================
-- 05_cr_approvals.sql — ผลพิจารณาของ approver (LAB 4C: POST /:id/approval)
-- SQL Server (T-SQL)
-- รันหลัง 02_change_requests.sql (FK อ้าง change_requests + users)
--
-- result เก็บตามที่หน้าเว็บส่ง (more-info ขีดกลาง)
-- ต่างจาก status ใน change_requests ที่ใช้ more_info ขีดล่าง
-- ============================================

USE CR;
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

-- ============================================
-- 04_cr_action_plans.sql — ตาราง action plan (1 แถวฟอร์ม = 1 แถวนี้)
-- SQL Server (T-SQL)
-- รันหลัง 02_change_requests.sql (FK อ้าง change_requests)
--
-- start_date/end_date เก็บเป็น NVARCHAR เพราะหน้าเว็บส่งเวลา ("10:00")
-- มาลงช่องนี้ ไม่ใช่วันที่ — ถ้าใช้ DATE จริง INSERT จะพัง
-- ============================================

USE CR;
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

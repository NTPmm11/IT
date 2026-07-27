-- ============================================
-- 06_cr_rollback_plans.sql — ตาราง "แผนการกู้คืน (Roll Back Plan)" ในฟอร์ม
-- SQL Server (T-SQL)
-- รันหลัง 02_change_requests.sql (FK อ้าง change_requests)
--
-- โครงสร้างเหมือน cr_action_plans (04_cr_action_plans.sql) ทุกอย่าง
-- แยกเป็นคนละตาราง เพราะฟอร์มมี 2 ตารางอิสระกัน (Action Plan ปกติ + Roll Back Plan)
-- คนละชุดข้อมูล ไม่ใช่ variant ของกันและกัน
-- start_date/end_date เก็บเป็น NVARCHAR ด้วยเหตุผลเดียวกับ cr_action_plans
-- (หน้าเว็บส่งเวลา ไม่ใช่วันที่ ลงช่องนี้ — ใช้ DATE จริง INSERT จะพัง)
-- ============================================

USE CR;
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

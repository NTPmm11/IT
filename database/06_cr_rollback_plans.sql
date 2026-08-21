-- ============================================
-- 06_cr_rollback_plans.sql — ตาราง "แผนการกู้คืน (Roll Back Plan)" ในฟอร์ม
-- MySQL 
-- รันหลัง 02_change_requests.sql (FK อ้าง change_requests)
--
-- โครงสร้างเหมือน cr_action_plans (04_cr_action_plans.sql) ทุกอย่าง
-- แยกเป็นคนละตาราง เพราะฟอร์มมี 2 ตารางอิสระกัน (Action Plan ปกติ + Roll Back Plan)
-- คนละชุดข้อมูล ไม่ใช่ variant ของกันและกัน
-- start_date/end_date เก็บเป็น VARCHAR ด้วยเหตุผลเดียวกับ cr_action_plans
-- (หน้าเว็บส่งเวลา ไม่ใช่วันที่ ลงช่องนี้ — ใช้ DATE จริง INSERT จะพัง)
-- ============================================

USE CR;

CREATE TABLE cr_rollback_plans (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  cr_id      INT           NOT NULL,
  seq_no     INT           NOT NULL,
  step       VARCHAR(255)  NOT NULL,
  start_date VARCHAR(50)   NULL,
  end_date   VARCHAR(50)   NULL,
  owner      VARCHAR(100)  NULL,
  note       VARCHAR(255)  NULL,
  FOREIGN KEY (cr_id) REFERENCES change_requests(cr_id) ON DELETE CASCADE
);

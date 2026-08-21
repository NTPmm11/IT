-- ============================================
-- 04_cr_action_plans.sql — ตาราง action plan (1 แถวฟอร์ม = 1 แถวนี้)
-- MySQL 
-- รันหลัง 02_change_requests.sql (FK อ้าง change_requests)

-- start_date/end_date เก็บเป็น VARCHAR เพราะหน้าเว็บส่งเวลา ("10:00")
-- มาลงช่องนี้ ไม่ใช่วันที่ — ถ้าใช้ DATE จริง INSERT จะพัง
-- ============================================

USE CR;

CREATE TABLE cr_action_plans (
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

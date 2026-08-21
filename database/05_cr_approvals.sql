-- ============================================
-- 05_cr_approvals.sql — ผลพิจารณาของ approver (LAB 4C: POST /:id/approval)
-- MySQL 
-- รันหลัง 02_change_requests.sql (FK อ้าง change_requests + users)

-- result เก็บตามที่หน้าเว็บส่ง (more-info ขีดกลาง)
-- ต่างจาก status ใน change_requests ที่ใช้ more_info ขีดล่าง
-- ============================================

USE CR;

CREATE TABLE cr_approvals (
  approval_id   INT AUTO_INCREMENT PRIMARY KEY,
  cr_id         INT           NOT NULL,
  approver_id   INT           NOT NULL,
  result        VARCHAR(20)   NOT NULL,
  comment       TEXT          NULL,
  approval_date DATE          NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cr_id) REFERENCES change_requests(cr_id) ON DELETE CASCADE,
  FOREIGN KEY (approver_id) REFERENCES users(user_id)
);

-- ============================================
-- 02_change_requests.sql — ใบ CR หลัก (LAB 4B: POST /api/change-requests)
-- MySQL 
-- รันหลัง 01_systems.sql (FK อ้าง users + systems)
-- ============================================

USE CR;

CREATE TABLE change_requests (
  cr_id          INT AUTO_INCREMENT PRIMARY KEY,
  cr_number      VARCHAR(30)  NOT NULL UNIQUE,
  request_date   DATE         NULL,
  requester_id   INT          NOT NULL,
  department     VARCHAR(100) NULL,
  system_id      INT          NOT NULL,
  contact        VARCHAR(100) NULL,
  priority       ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Low',
  subject        VARCHAR(255) NOT NULL,
  problem        TEXT         NULL,
  request_detail TEXT         NULL,
  impact         ENUM('none','other') NOT NULL DEFAULT 'none',
  impact_detail  VARCHAR(255) NULL,
  downtime       TINYINT(1)   NOT NULL DEFAULT 0,
  duration       VARCHAR(50)  NULL,
  deploy_date    DATE         NULL,
  status         ENUM('draft','submitted','approved','rejected','more_info') NOT NULL DEFAULT 'submitted',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (requester_id) REFERENCES users(user_id),
  FOREIGN KEY (system_id) REFERENCES systems(system_id)
);

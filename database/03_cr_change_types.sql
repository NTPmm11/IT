-- ============================================
-- 03_cr_change_types.sql — checkbox ประเภทการเปลี่ยน (1 ติ๊ก = 1 แถว)
-- MySQL 
-- รันหลัง 02_change_requests.sql (FK อ้าง change_requests)
-- ============================================

USE CR;

CREATE TABLE cr_change_types (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  cr_id       INT          NOT NULL,
  change_type ENUM('App','DB','Infra') NOT NULL,
  FOREIGN KEY (cr_id) REFERENCES change_requests(cr_id) ON DELETE CASCADE
);

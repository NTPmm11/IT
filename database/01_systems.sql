-- ============================================
-- 01_systems.sql — ตัวเลือก dropdown "ระบบที่เกี่ยวข้อง"
-- MySQL 
-- รันหลัง users_only.sql / รันก่อน 02_change_requests.sql (โดน FK อ้างถึง)
-- ============================================

USE CR;

CREATE TABLE systems (
  system_id   INT AUTO_INCREMENT PRIMARY KEY,
  system_code VARCHAR(20)  NOT NULL UNIQUE,
  system_name VARCHAR(100) NOT NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1
);

INSERT INTO systems (system_code, system_name) VALUES
  ('SRV', 'Server'),
  ('NET', 'Network'),
  ('DB',  'Database'),
  ('APP', 'Application'),
  ('UPS', 'UPS'),
  ('BAK', 'Backup');

-- ============================================
-- schema.sql — IT Change Request (CR) System
-- MySQL 8.x / utf8mb4
-- ============================================

CREATE DATABASE IF NOT EXISTS it_change_request
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE it_change_request;

-- --------------------------------------------
-- 1. users — บัญชีผู้ใช้ (หน้า login: index.html)
-- --------------------------------------------
CREATE TABLE users (
  user_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,              -- เก็บ hash เท่านั้น ห้ามเก็บ plain text
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(100),
  department    VARCHAR(100),
  role          ENUM('requester','it_admin','approver') NOT NULL DEFAULT 'requester',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- --------------------------------------------
-- 2. systems — ระบบที่เกี่ยวข้อง (dropdown ใน form)
-- --------------------------------------------
CREATE TABLE systems (
  system_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  system_code VARCHAR(30)  NOT NULL UNIQUE,          -- เช่น web-portal, mobile-app, sap
  system_name VARCHAR(100) NOT NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB;

INSERT INTO systems (system_code, system_name) VALUES
  ('web-portal', 'Web Portal Schema'),
  ('mobile-app', 'Mobile Application'),
  ('sap',        'SAP / ERP System');

-- --------------------------------------------
-- 3. change_requests — ฟอร์ม CR หลัก (section 1-3 ใน form.html)
-- --------------------------------------------
CREATE TABLE change_requests (
  cr_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cr_number     VARCHAR(20)  NOT NULL UNIQUE,        -- เลขที่เอกสาร เช่น CR6908001

  -- [1] ข้อมูลทั่วไป
  request_date  DATE         NOT NULL,
  requester_id  INT UNSIGNED NOT NULL,               -- FK -> users
  department    VARCHAR(100),
  system_id     INT UNSIGNED NOT NULL,               -- FK -> systems
  contact       VARCHAR(100),                        -- อีเมล/เบอร์โทร
  priority      ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Low',

  -- [2] รายละเอียดการขอเปลี่ยน
  subject       VARCHAR(255) NOT NULL,
  problem       TEXT,                                -- สถานะปัจจุบัน/ปัญหาที่พบ
  request_detail TEXT,                               -- สิ่งที่ต้องการให้ปรับปรุง

  -- [3] การประเมินผลกระทบ (เฉพาะสิทธิ์ IT/Admin)
  impact        ENUM('none','other') NOT NULL DEFAULT 'none',
  impact_detail VARCHAR(255),                        -- ระบุเมื่อ impact = 'other'
  downtime      TINYINT(1)   NOT NULL DEFAULT 0,     -- ต้องปิดระบบชั่วคราว
  duration      VARCHAR(50),                         -- ระยะเวลาที่คาดใช้ เช่น "2 วัน"
  deploy_date   DATE,                                -- เป้าหมาย deploy

  -- สถานะเอกสาร
  status        ENUM('draft','submitted','approved','rejected','more_info')
                NOT NULL DEFAULT 'draft',

  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_cr_requester FOREIGN KEY (requester_id) REFERENCES users(user_id),
  CONSTRAINT fk_cr_system    FOREIGN KEY (system_id)    REFERENCES systems(system_id),
  INDEX idx_cr_status (status),
  INDEX idx_cr_request_date (request_date)
) ENGINE=InnoDB;

-- --------------------------------------------
-- 4. cr_change_types — ประเภทการเปลี่ยน (checkbox หลายค่า)
--    1 CR เลือกได้หลายประเภท -> แยกตาราง 1 แถวต่อ 1 ประเภท
-- --------------------------------------------
CREATE TABLE cr_change_types (
  cr_id       INT UNSIGNED NOT NULL,
  change_type ENUM('App','DB','Infra') NOT NULL,
  PRIMARY KEY (cr_id, change_type),
  CONSTRAINT fk_ct_cr FOREIGN KEY (cr_id)
    REFERENCES change_requests(cr_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------
-- 5. cr_action_plans — แผนดำเนินงาน (section 4: ตาราง rows)
--    1 แถวในตาราง = 1 record
-- --------------------------------------------
CREATE TABLE cr_action_plans (
  plan_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cr_id      INT UNSIGNED NOT NULL,
  seq_no     INT UNSIGNED NOT NULL,                  -- ลำดับขั้นตอน
  step       VARCHAR(255) NOT NULL,                  -- ขั้นตอนงาน
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  owner      VARCHAR(100),                           -- ผู้รับผิดชอบ
  note       VARCHAR(255),
  CONSTRAINT fk_plan_cr FOREIGN KEY (cr_id)
    REFERENCES change_requests(cr_id) ON DELETE CASCADE,
  UNIQUE KEY uq_plan_seq (cr_id, seq_no)
) ENGINE=InnoDB;

-- --------------------------------------------
-- 6. cr_approvals — ผลการพิจารณา (section 5: approve.html)
-- --------------------------------------------
CREATE TABLE cr_approvals (
  approval_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cr_id         INT UNSIGNED NOT NULL,
  approver_id   INT UNSIGNED NOT NULL,               -- FK -> users (role approver)
  result        ENUM('approved','rejected','more-info') NOT NULL,
  comment       TEXT,                                -- ความเห็นทีมพัฒนา/ผู้ประเมิน
  approval_date DATE NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ap_cr       FOREIGN KEY (cr_id)       REFERENCES change_requests(cr_id) ON DELETE CASCADE,
  CONSTRAINT fk_ap_approver FOREIGN KEY (approver_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- --------------------------------------------
-- ข้อมูลตัวอย่าง (sample data)
-- --------------------------------------------
INSERT INTO users (username, password_hash, full_name, email, department, role) VALUES
  ('admin',    '$2y$10$REPLACE_WITH_REAL_HASH', 'ผู้ดูแลระบบ',   'admin@company.com',    'IT',        'it_admin'),
  ('somchai',  '$2y$10$REPLACE_WITH_REAL_HASH', 'สมชาย ใจดี',    'somchai@company.com',  'Marketing', 'requester'),
  ('approver1','$2y$10$REPLACE_WITH_REAL_HASH', 'หัวหน้าฝ่าย IT', 'approver@company.com', 'IT',        'approver');

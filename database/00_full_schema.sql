-- ============================================
-- 00_full_schema.sql — รวมทุกไฟล์ (users_only.sql + 01..06) เป็นไฟล์เดียว
-- MySQL / MySQL Workbench Schema
-- รันไฟล์นี้ไฟล์เดียวพอ ไม่ต้องรันทีละไฟล์ 7 รอบ
-- (ลำดับตารางในนี้เรียงตาม FK ไว้แล้ว: users -> systems -> change_requests -> cr_change_types -> cr_action_plans -> cr_approvals -> cr_rollback_plans)
--  password_hash ของ users ด้านล่างเป็น placeholder ('$REPLACE_WITH_REAL_HASH') ทำให้จะไม่สามารถ login ได้จนกว่าจะเปลี่ยนให้เป็น bcrypt hash จริง เช่น:
--  node -e "console.log(require('bcryptjs').hashSync('1234', 10))"
--  แล้ว UPDATE users SET password_hash = '<hash ที่ได้>' WHERE username = 'admin';
-- ============================================

CREATE DATABASE IF NOT EXISTS CR CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE CR;

-- 1. users (จาก users_only.sql)
CREATE TABLE users (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(100),
  department    VARCHAR(100),
  role          ENUM('requester','it_admin','approver') NOT NULL DEFAULT 'requester',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO users (username, password_hash, full_name, email, department, role) VALUES
  ('admin',     '$REPLACE_WITH_REAL_HASH', 'ผู้ดูแลระบบ',    'pungzaza44@gmail.com', 'IT',        'it_admin'),
  ('somchai',   '$REPLACE_WITH_REAL_HASH', 'สมชาย ใจดี',     'somchai@company.com',  'Marketing', 'requester'),
  ('approver1', '$REPLACE_WITH_REAL_HASH', 'หัวหน้าฝ่าย IT', 'approver@company.com', 'IT',        'approver');

-- 2. systems (จาก 01_systems.sql)
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

-- 3. change_requests (จาก 02_change_requests.sql)
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

-- 4. cr_change_types (จาก 03_cr_change_types.sql) 
CREATE TABLE cr_change_types (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  cr_id       INT          NOT NULL,
  change_type ENUM('App','DB','Infra') NOT NULL,
  FOREIGN KEY (cr_id) REFERENCES change_requests(cr_id) ON DELETE CASCADE
);

-- 5. cr_action_plans (จาก 04_cr_action_plans.sql)
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

-- 6. cr_approvals (จาก 05_cr_approvals.sql)
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

-- 7. cr_rollback_plans (จาก 06_cr_rollback_plans.sql)
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


-- ============================================
-- users_only.sql — เฉพาะของ login (users table)
-- MySQL 
-- รันไฟล์นี้ก่อนได้ ค่อยเพิ่ม table อื่น (systems, change_requests, ...)
-- ทีหลังจาก schema.sql ตอนพร้อมทำ LAB ถัดไป
-- ============================================

CREATE DATABASE IF NOT EXISTS CR CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE CR;

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

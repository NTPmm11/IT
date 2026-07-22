-- ============================================
-- 01_systems.sql — ตัวเลือก dropdown "ระบบที่เกี่ยวข้อง"
-- SQL Server (T-SQL)
-- รันหลัง users_only.sql / รันก่อน 02_change_requests.sql (โดน FK อ้างถึง)
-- ============================================

USE CR;
GO

CREATE TABLE systems (
  system_id   INT IDENTITY(1,1) PRIMARY KEY,
  system_code NVARCHAR(20)  NOT NULL UNIQUE,
  system_name NVARCHAR(100) NOT NULL,
  is_active   BIT           NOT NULL DEFAULT 1
);
GO

INSERT INTO systems (system_code, system_name) VALUES
  (N'WEB',  N'Web Portal'),
  (N'ERP',  N'ERP System'),
  (N'CRM',  N'CRM System'),
  (N'HR',   N'HR Management'),
  (N'ACC',  N'Accounting System');
GO

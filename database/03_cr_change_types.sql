-- ============================================
-- 03_cr_change_types.sql — checkbox ประเภทการเปลี่ยน (1 ติ๊ก = 1 แถว)
-- SQL Server (T-SQL)
-- รันหลัง 02_change_requests.sql (FK อ้าง change_requests)
-- ============================================

USE CR;
GO

CREATE TABLE cr_change_types (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  cr_id       INT          NOT NULL REFERENCES change_requests(cr_id) ON DELETE CASCADE,
  change_type NVARCHAR(20) NOT NULL CHECK (change_type IN ('App','DB','Infra'))
);
GO

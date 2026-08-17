-- ============================================
-- 07_cr_number_sequence.sql — ตัวแจกเลขที่เอกสาร (cr_number)
-- SQL Server (T-SQL)
-- ============================================
--
-- ปัญหาเดิม: cr_number สร้างจาก cr_id (IDENTITY) และหน้าฟอร์ม preview เลขถัดไป
-- ด้วย MAX(cr_id) + 1 — สองอย่างนี้ไม่ใช่ตัวนับเดียวกัน
--   * insert ที่ rollback / แถวที่ถูกลบ = IDENTITY เดินหน้าไปแล้ว แต่ MAX(cr_id) ไม่ขยับ
--   * ผลคือ preview บอก CR0000008 แต่ submit จริงได้ CR0000012
--
-- ทางแก้: ให้ทั้ง "ตอน preview" และ "ตอนออกเลขจริง" อ่านตัวนับตัวเดียวกัน = SEQUENCE
--   preview   -> sys.sequences.current_value + increment
--   ออกเลขจริง -> NEXT VALUE FOR dbo.cr_number_seq
-- เหลือเพียงกรณีมีคนกด submit แทรกระหว่างที่เราเปิดฟอร์มค้างไว้ (เลี่ยงไม่ได้โดยธรรมชาติ)
--
-- รันไฟล์นี้ได้หลายครั้ง — มีอยู่แล้วจะข้ามให้เอง

USE CR;
GO

IF OBJECT_ID('dbo.cr_number_seq', 'SO') IS NULL
BEGIN
    -- เริ่มนับจากเลขสูงสุดที่ใช้ไปแล้วในตาราง (ไม่ใช่ MAX(cr_id) — อ่านจาก cr_number จริง)
    DECLARE @start INT = (
        SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(cr_number, 3, 20) AS INT)), 0)
        FROM change_requests
        WHERE cr_number LIKE 'CR%'
    );

    DECLARE @sql NVARCHAR(MAX) =
        N'CREATE SEQUENCE dbo.cr_number_seq AS INT START WITH '
        + CAST(@start AS NVARCHAR(20)) + N' INCREMENT BY 1 NO CACHE;';
    EXEC sp_executesql @sql;

    -- กินค่าแรกทิ้ง 1 ครั้ง: sequence ที่ยังไม่เคยถูกเรียก current_value = start
    -- และ NEXT VALUE ครั้งแรกก็คืน start เอง -> สูตร preview (current_value + increment)
    -- จะเพี้ยนไป 1 เฉพาะครั้งแรก กินทิ้งก่อนแล้วสูตรตรงตลอด
    -- (ค่าที่กินทิ้งคือเลขที่ถูกใช้ไปแล้วอยู่ดี ไม่ได้ทำให้เลขหาย)
    DECLARE @burn INT = NEXT VALUE FOR dbo.cr_number_seq;
END
GO

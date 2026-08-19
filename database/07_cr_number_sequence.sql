
USE CR;
GO

IF OBJECT_ID('dbo.cr_number_seq', 'SO') IS NULL
BEGIN
    DECLARE @start INT = (
        SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(cr_number, 3, 20) AS INT)), 0)
        FROM change_requests
        WHERE cr_number LIKE 'CR%'
    );

    DECLARE @sql NVARCHAR(MAX) =
        N'CREATE SEQUENCE dbo.cr_number_seq AS INT START WITH '
        + CAST(@start AS NVARCHAR(20)) + N' INCREMENT BY 1 NO CACHE;';
    EXEC sp_executesql @sql;

    DECLARE @burn INT = NEXT VALUE FOR dbo.cr_number_seq;
END
GO

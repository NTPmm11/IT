
USE CR;
GO

IF COL_LENGTH('users', 'password_hash') IS NOT NULL
BEGIN
    ALTER TABLE users ALTER COLUMN password_hash NVARCHAR(255) NULL;
END
GO


USE CR;
GO

CREATE TABLE cr_change_types (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  cr_id       INT          NOT NULL REFERENCES change_requests(cr_id) ON DELETE CASCADE,
  change_type NVARCHAR(20) NOT NULL CHECK (change_type IN ('App','DB','Infra'))
);
GO

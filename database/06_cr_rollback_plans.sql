
USE CR;
GO

CREATE TABLE cr_rollback_plans (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  cr_id      INT           NOT NULL REFERENCES change_requests(cr_id) ON DELETE CASCADE,
  seq_no     INT           NOT NULL,
  step       NVARCHAR(255) NOT NULL,
  start_date NVARCHAR(50)  NULL,
  end_date   NVARCHAR(50)  NULL,
  owner      NVARCHAR(100) NULL,
  note       NVARCHAR(255) NULL
);
GO

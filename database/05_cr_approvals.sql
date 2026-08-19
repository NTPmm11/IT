
USE CR;
GO

CREATE TABLE cr_approvals (
  approval_id   INT IDENTITY(1,1) PRIMARY KEY,
  cr_id         INT           NOT NULL REFERENCES change_requests(cr_id) ON DELETE CASCADE,
  approver_id   INT           NOT NULL REFERENCES users(user_id),
  result        NVARCHAR(20)  NOT NULL CHECK (result IN ('approved','rejected','more-info')),
  comment       NVARCHAR(MAX) NULL,
  approval_date DATE          NULL,
  created_at    DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

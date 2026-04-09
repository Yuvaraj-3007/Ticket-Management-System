-- Update Status enum to match current schema
-- PostgreSQL requires renaming the old type and creating a new one to change enum values

ALTER TYPE "Status" RENAME TO "Status_old";

CREATE TYPE "Status" AS ENUM (
  'UN_ASSIGNED',
  'OPEN_NOT_STARTED',
  'OPEN_IN_PROGRESS',
  'OPEN_QA',
  'OPEN_DONE',
  'CLOSED'
);

-- Drop default before changing column type (required by PostgreSQL)
ALTER TABLE "tickets" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "tickets"
  ALTER COLUMN "status" TYPE "Status"
    USING CASE "status"::text
      WHEN 'OPEN'        THEN 'OPEN_NOT_STARTED'
      WHEN 'IN_PROGRESS' THEN 'OPEN_IN_PROGRESS'
      WHEN 'RESOLVED'    THEN 'OPEN_DONE'
      WHEN 'CLOSED'      THEN 'CLOSED'
      WHEN 'NEW'         THEN 'UN_ASSIGNED'
      WHEN 'PROCESSING'  THEN 'OPEN_IN_PROGRESS'
      ELSE 'UN_ASSIGNED'
    END::"Status";

ALTER TABLE "tickets" ALTER COLUMN "status" SET DEFAULT 'UN_ASSIGNED'::"Status";

DROP TYPE "Status_old";

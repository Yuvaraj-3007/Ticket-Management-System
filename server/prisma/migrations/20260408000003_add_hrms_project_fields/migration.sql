-- Add HRMS project fields to tickets (added via db push, now creating proper migration)
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "hrmsProjectId"   TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "hrmsProjectName" TEXT;

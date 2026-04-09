-- Add HRMS client fields and customer rating fields to tickets
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "hrmsClientId"   TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "hrmsClientName" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "rating"         INTEGER;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "ratingText"     TEXT;

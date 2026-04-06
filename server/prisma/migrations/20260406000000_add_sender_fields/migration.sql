-- Add optional sender identity fields to tickets
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "senderName"  TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "senderEmail" TEXT;

-- Add commentId to attachments table to support comment file attachments
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "commentId" TEXT REFERENCES "comments"("id") ON DELETE SET NULL;

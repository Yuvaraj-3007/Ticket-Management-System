-- Make attachments.ticketId nullable so comment-only attachments can be stored without a ticket reference
ALTER TABLE "attachments" DROP CONSTRAINT IF EXISTS "attachments_ticketId_fkey";
ALTER TABLE "attachments" ALTER COLUMN "ticketId" DROP NOT NULL;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add 5 status values (each ALTER TYPE ADD VALUE must be its own statement)
ALTER TYPE "Status" ADD VALUE 'SUBMITTED';
ALTER TYPE "Status" ADD VALUE 'ADMIN_REVIEW';
ALTER TYPE "Status" ADD VALUE 'PLANNING';
ALTER TYPE "Status" ADD VALUE 'CUSTOMER_APPROVAL';
ALTER TYPE "Status" ADD VALUE 'APPROVED';

-- Implementation request 1:1 with Ticket
CREATE TABLE "implementation_requests" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "businessGoal" TEXT NOT NULL,
    "currentPain" TEXT NOT NULL,
    "expectedOutcome" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3),
    "planContent" TEXT,
    "planPostedAt" TIMESTAMP(3),
    "customerApprovedAt" TIMESTAMP(3),
    "customerRejectedAt" TIMESTAMP(3),
    "customerRejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "implementation_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "implementation_requests_ticketId_key" ON "implementation_requests"("ticketId");

ALTER TABLE "implementation_requests" ADD CONSTRAINT "implementation_requests_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

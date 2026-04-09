-- Add portalClientId to user table for customer-to-client portal binding
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "portalClientId" TEXT;

-- Add REOPENED to Status enum (PostgreSQL additive migration)
ALTER TYPE "Status" ADD VALUE 'REOPENED';

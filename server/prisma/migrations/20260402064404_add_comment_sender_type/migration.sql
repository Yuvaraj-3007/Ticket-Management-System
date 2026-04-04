-- CreateEnum
CREATE TYPE "CommentSenderType" AS ENUM ('AGENT', 'CUSTOMER');

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "senderType" "CommentSenderType" NOT NULL DEFAULT 'AGENT';

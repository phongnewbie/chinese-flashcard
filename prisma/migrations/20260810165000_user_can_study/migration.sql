-- AlterTable
ALTER TABLE "User" ADD COLUMN "canStudy" BOOLEAN NOT NULL DEFAULT false;

-- Sync existing premium users
UPDATE "User" SET "canStudy" = true WHERE "isPremium" = true;

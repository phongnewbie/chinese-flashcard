-- AppSetting: SRS config
ALTER TABLE "AppSetting" ADD COLUMN "maxNewPerDay" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "AppSetting" ADD COLUMN "learningSteps" TEXT NOT NULL DEFAULT '1,10';

-- Course: multi-card types per deck
ALTER TABLE "Course" ADD COLUMN "cardTypes" TEXT;

-- Flashcard: flag, subdeck
ALTER TABLE "Flashcard" ADD COLUMN "flag" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Flashcard" ADD COLUMN "subdeck" TEXT;

-- CardReview: multi-card, suspend, bury
ALTER TABLE "CardReview" ADD COLUMN "cardType" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "CardReview" ADD COLUMN "suspended" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CardReview" ADD COLUMN "buriedUntil" DATETIME;

-- Drop old unique, add new composite unique
DROP INDEX IF EXISTS "CardReview_userId_cardId_key";
CREATE UNIQUE INDEX "CardReview_userId_cardId_cardType_key" ON "CardReview"("userId", "cardId", "cardType");

-- Review log
CREATE TABLE "ReviewLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "cardType" TEXT NOT NULL DEFAULT 'default',
    "rating" INTEGER NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReviewLog_userId_reviewedAt_idx" ON "ReviewLog"("userId", "reviewedAt");

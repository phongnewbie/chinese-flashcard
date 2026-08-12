-- AlterTable
ALTER TABLE "Course" ADD COLUMN "backTemplate" TEXT;
ALTER TABLE "Course" ADD COLUMN "cardCss" TEXT;
ALTER TABLE "Course" ADD COLUMN "frontTemplate" TEXT;

-- CreateTable
CREATE TABLE "CardReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "ease" REAL NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "learningStep" INTEGER NOT NULL DEFAULT 0,
    "dueAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewAt" DATETIME,
    CONSTRAINT "CardReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CardReview_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Flashcard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CardReview_userId_dueAt_idx" ON "CardReview"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "CardReview_userId_cardId_key" ON "CardReview"("userId", "cardId");

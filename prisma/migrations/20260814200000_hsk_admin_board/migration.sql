-- AlterTable
ALTER TABLE "Course" ADD COLUMN "hskLevel" TEXT;
ALTER TABLE "Course" ADD COLUMN "primarySection" TEXT;
ALTER TABLE "Course" ADD COLUMN "lessonNumber" INTEGER;

-- CreateTable
CREATE TABLE "UserHskLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "hskLevel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserHskLevel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserHskLevel_hskLevel_idx" ON "UserHskLevel"("hskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "UserHskLevel_userId_hskLevel_key" ON "UserHskLevel"("userId", "hskLevel");

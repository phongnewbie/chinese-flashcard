-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Flashcard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'vocabulary',
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "pinyin" TEXT,
    "audioUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Flashcard_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Flashcard" ("audioUrl", "back", "courseId", "front", "id", "pinyin", "sortOrder") SELECT "audioUrl", "back", "courseId", "front", "id", "pinyin", "sortOrder" FROM "Flashcard";
DROP TABLE "Flashcard";
ALTER TABLE "new_Flashcard" RENAME TO "Flashcard";
CREATE INDEX "Flashcard_courseId_section_idx" ON "Flashcard"("courseId", "section");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

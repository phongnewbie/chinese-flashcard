export const HSK_LEVELS = [
  { id: "hsk1", label: "hsk1" },
  { id: "hsk2", label: "hsk2" },
  { id: "hsk3", label: "hsk3" },
  { id: "hsk4", label: "hsk4" },
  { id: "hsk5", label: "hsk5" },
  { id: "hsk6", label: "hsk6" },
  { id: "hsk7-9", label: "hsk7-9" },
] as const;

export type HskLevelId = (typeof HSK_LEVELS)[number]["id"];

export const HSK_CATEGORIES = [
  { id: "vocabulary", label: "từ vựng" },
  { id: "grammar", label: "ngữ pháp" },
  { id: "sentence_order", label: "sắp xếp câu" },
  { id: "common", label: "giao tiếp thông dụng" },
] as const;

export type HskCategoryId = (typeof HSK_CATEGORIES)[number]["id"];

export function categoriesForLevel(levelId: string): typeof HSK_CATEGORIES[number][] {
  if (levelId === "hsk7-9") {
    return HSK_CATEGORIES.filter((c) => c.id === "vocabulary");
  }
  return [...HSK_CATEGORIES];
}

export function categoryLabel(id: string): string {
  return HSK_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** Nhãn hiển thị trên màn Bộ thẻ kiểu Anki */
export function categoryDeckLabel(id: string, levelId: string): string {
  const idx = categoriesForLevel(levelId).findIndex((c) => c.id === id);
  const num = idx >= 0 ? idx + 1 : 0;
  const name = categoryLabel(id).toUpperCase();
  return num ? `${num}. ${name}` : name;
}

export function levelLabel(id: string): string {
  return HSK_LEVELS.find((l) => l.id === id)?.label ?? id;
}

export function defaultLessonTitle(
  levelId: string,
  categoryId: string,
  lessonNumber: number,
): string {
  return `${levelLabel(levelId).toUpperCase()} — ${categoryLabel(categoryId)} — Bài ${lessonNumber}`;
}

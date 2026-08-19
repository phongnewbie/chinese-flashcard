export const STUDY_SECTIONS = [
  { id: "vocabulary", label: "Từ vựng" },
  { id: "grammar", label: "Ngữ pháp" },
  { id: "sentence_order", label: "Sắp xếp câu" },
  { id: "common", label: "Tiếng Trung thông dụng" },
] as const;

export type StudySectionId = (typeof STUDY_SECTIONS)[number]["id"];

const SECTION_ALIASES: Record<string, StudySectionId> = {
  vocabulary: "vocabulary",
  vocab: "vocabulary",
  tu_vung: "vocabulary",
  "từ vựng": "vocabulary",
  "tu vung": "vocabulary",
  "1": "vocabulary",

  grammar: "grammar",
  ngu_phap: "grammar",
  "ngữ pháp": "grammar",
  "ngu phap": "grammar",
  "2": "grammar",

  sentence_order: "sentence_order",
  sentence: "sentence_order",
  sap_xep_cau: "sentence_order",
  "sắp xếp câu": "sentence_order",
  "sap xep cau": "sentence_order",
  "3": "sentence_order",

  common: "common",
  thong_dung: "common",
  "thông dụng": "common",
  "tiếng trung thông dụng": "common",
  "tieng trung thong dung": "common",
  "4": "common",
};

const SHEET_ALIASES: Record<string, StudySectionId> = {
  "từ vựng": "vocabulary",
  "tu vung": "vocabulary",
  vocabulary: "vocabulary",
  "ngữ pháp": "grammar",
  "ngu phap": "grammar",
  grammar: "grammar",
  "sắp xếp câu": "sentence_order",
  "sap xep cau": "sentence_order",
  "sentence order": "sentence_order",
  "tiếng trung thông dụng": "common",
  "tieng trung thong dung": "common",
  "thông dụng": "common",
  common: "common",
};

export function parseSectionValue(raw: string | undefined): StudySectionId {
  if (!raw?.trim()) return "vocabulary";
  const key = raw.trim().toLowerCase();
  return SECTION_ALIASES[key] ?? SHEET_ALIASES[key] ?? "vocabulary";
}

export function sectionFromSheetName(sheetName: string): StudySectionId | null {
  const key = sheetName.trim().toLowerCase();
  return SHEET_ALIASES[key] ?? SECTION_ALIASES[key] ?? null;
}

export function sectionLabel(id: StudySectionId): string {
  return STUDY_SECTIONS.find((s) => s.id === id)?.label ?? id;
}

/** Một bộ thẻ HSK chỉ thuộc một danh mục (từ vựng / ngữ pháp / …). */
export function lockedSectionForCourse(course: {
  primarySection?: string | null;
  hskLevel?: string | null;
}): StudySectionId | null {
  if (course.primarySection) return parseSectionValue(course.primarySection);
  if (course.hskLevel) return "vocabulary";
  return null;
}

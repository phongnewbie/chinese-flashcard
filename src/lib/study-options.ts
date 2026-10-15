export type SectionStudyOptions = {
  audioDelayMs?: number;
  audioWordFirst?: boolean;
  audioExampleOnReveal?: boolean;
  hintFields?: string;
  hintLabel?: string;
  /** Placeholder ô gõ chữ khi học */
  inputPlaceholder?: string;
};

export function defaultStudyOptionsForSection(section: string): SectionStudyOptions {
  switch (section) {
    case "grammar":
      return {
        audioDelayMs: 200,
        audioWordFirst: true,
        audioExampleOnReveal: true,
        hintFields: "CẤU TRÚC,ĐIỂM NGỮ PHÁP",
        hintLabel: "Gợi ý",
        inputPlaceholder: "Gõ câu tiếng Trung...",
      };
    case "vocabulary":
      return {
        audioDelayMs: 200,
        audioWordFirst: true,
        audioExampleOnReveal: true,
        hintFields: "Nghĩa hán việt,Loại từ",
        hintLabel: "Gợi ý",
        inputPlaceholder: "Gõ chữ Hán...",
      };
    case "common":
      return {
        audioDelayMs: 200,
        audioWordFirst: true,
        audioExampleOnReveal: false,
        hintFields: "VÍ DỤ",
        hintLabel: "Gợi ý",
        inputPlaceholder: "Gõ cụm tiếng Trung...",
      };
    default:
      return {
        audioDelayMs: 200,
        audioWordFirst: true,
        audioExampleOnReveal: true,
        hintFields: "",
        hintLabel: "Gợi ý",
        inputPlaceholder: "Gõ đáp án...",
      };
  }
}

export function resolveStudyOptions(
  section: string,
  saved?: SectionStudyOptions | null,
): SectionStudyOptions {
  return { ...defaultStudyOptionsForSection(section), ...(saved ?? {}) };
}

export type HintLine = { label: string; value: string };

export function hintLinesFromFields(
  fields: Record<string, string> | null | undefined,
  hintFields?: string,
): HintLine[] {
  if (!fields || !hintFields?.trim()) return [];
  return hintFields
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((label) => {
      const value =
        fields[label]?.trim() ||
        Object.entries(fields).find(([k]) => k.toLowerCase() === label.toLowerCase())?.[1]?.trim() ||
        "";
      return value ? { label, value } : null;
    })
    .filter((x): x is HintLine => x !== null);
}

export function stripFieldHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
}


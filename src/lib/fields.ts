/** Trường tùy chỉnh kiểu Anki — JSON object trên Flashcard.extraFields */

export function parseExtraFields(raw: string | null | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v != null && String(v).trim()) out[k] = String(v).trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function stringifyExtraFields(fields: Record<string, string>): string | null {
  const clean = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v?.trim()),
  );
  return Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
}

export function parseFieldDefs(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map(String).filter(Boolean);
  } catch {
    return [];
  }
}

export function mergeFieldDefs(existing: string[], fromCards: Record<string, string>[]): string[] {
  const set = new Set(existing);
  for (const card of fromCards) {
    for (const key of Object.keys(card)) set.add(key);
  }
  return [...set];
}

export const STANDARD_FIELD_LABELS = ["Front", "Back", "Pinyin", "Audio", "Section"];

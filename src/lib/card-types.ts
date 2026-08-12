/** Loại thẻ sinh từ 1 note — giống Anki card types */

export const DEFAULT_VOCAB_CARD_TYPES = [
  { id: "viet_trung", label: "Việt → Trung", ord: 0 },
  { id: "trung_viet", label: "Trung → Việt", ord: 1 },
  { id: "card_3", label: "Thẻ 3", ord: 2 },
] as const;

export const DEFAULT_SINGLE_CARD_TYPE = [{ id: "default", label: "Default", ord: 0 }] as const;

export type CardTypeDef = { id: string; label: string; ord: number };

export function parseCourseCardTypes(raw: string | null | undefined, section: string): CardTypeDef[] {
  if (raw?.trim()) {
    try {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.map((item, i) => {
          if (typeof item === "string") return { id: item, label: item, ord: i };
          const o = item as { id?: string; label?: string; ord?: number };
          return {
            id: o.id ?? `type_${i}`,
            label: o.label ?? o.id ?? `Type ${i + 1}`,
            ord: o.ord ?? i,
          };
        });
      }
    } catch {
      /* fall through */
    }
  }
  if (section === "vocabulary") {
    return [...DEFAULT_VOCAB_CARD_TYPES];
  }
  return [...DEFAULT_SINGLE_CARD_TYPE];
}

export function cardTypeCount(section: string, cardTypesRaw: string | null | undefined): number {
  return parseCourseCardTypes(cardTypesRaw, section).length;
}

export function parseLearningSteps(raw: string | null | undefined): number[] {
  if (!raw?.trim()) return [1, 10];
  const steps = raw
    .split(/[,;]+/)
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !Number.isNaN(n) && n > 0);
  return steps.length > 0 ? steps : [1, 10];
}

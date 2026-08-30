/** Loại thẻ sinh từ 1 note — giống Anki card types */

export const DEFAULT_VOCAB_CARD_TYPES = [
  { id: "viet_trung", label: "Việt → Trung", ord: 0, layout: "viet_trung" as const, enabled: true },
  { id: "trung_viet", label: "Trung → Việt", ord: 1, layout: "trung_viet" as const, enabled: true },
  { id: "card_3", label: "Pinyin → Trung", ord: 2, layout: "pinyin_trung" as const, enabled: false },
] as const;

export const DEFAULT_SINGLE_CARD_TYPE = [
  { id: "default", label: "Default", ord: 0, layout: "default" as const, enabled: true },
] as const;

export type CardTypeLayout = "viet_trung" | "trung_viet" | "pinyin_trung" | "default" | "custom";

export type CardTypeDef = {
  id: string;
  label: string;
  ord: number;
  enabled?: boolean;
  layout?: CardTypeLayout;
  frontTemplate?: string | null;
  backTemplate?: string | null;
};

export const CARD_TYPE_LAYOUT_OPTIONS: { id: CardTypeLayout; label: string; hint: string }[] = [
  { id: "viet_trung", label: "Việt → Trung", hint: "Mặt trước tiếng Việt, mặt sau tiếng Trung" },
  { id: "trung_viet", label: "Trung → Việt", hint: "Mặt trước tiếng Trung, mặt sau tiếng Việt" },
  { id: "pinyin_trung", label: "Pinyin → Trung", hint: "Mặt trước phiên âm, mặt sau chữ Hán" },
  { id: "default", label: "Theo mẫu thẻ", hint: "Dùng đúng HTML mẫu thẻ (không đảo chiều)" },
  { id: "custom", label: "HTML riêng", hint: "Tự viết template mặt trước/sau cho kiểu thẻ này" },
];

function inferLayoutFromId(id: string): CardTypeLayout {
  if (id === "trung_viet") return "trung_viet";
  if (id === "viet_trung") return "viet_trung";
  if (id === "card_3") return "pinyin_trung";
  if (id === "default") return "default";
  return "viet_trung";
}

function normalizeCardType(item: unknown, index: number): CardTypeDef {
  if (typeof item === "string") {
    return {
      id: item,
      label: item,
      ord: index,
      enabled: true,
      layout: inferLayoutFromId(item),
    };
  }
  const o = item as CardTypeDef;
  return {
    id: o.id ?? `type_${index}`,
    label: o.label ?? o.id ?? `Kiểu ${index + 1}`,
    ord: o.ord ?? index,
    enabled: o.enabled !== false,
    layout: o.layout ?? inferLayoutFromId(o.id ?? ""),
    frontTemplate: o.frontTemplate ?? null,
    backTemplate: o.backTemplate ?? null,
  };
}

export function defaultCardTypesForSection(section: string): CardTypeDef[] {
  if (section === "vocabulary") {
    return DEFAULT_VOCAB_CARD_TYPES.map((t) => ({ ...t }));
  }
  if (section === "grammar") {
    return [{ id: "trung_viet", label: "Trung → Việt", ord: 0, layout: "trung_viet", enabled: true }];
  }
  if (section === "common") {
    return [{ id: "viet_trung", label: "Việt → Trung", ord: 0, layout: "viet_trung", enabled: true }];
  }
  return DEFAULT_SINGLE_CARD_TYPE.map((t) => ({ ...t }));
}

export function parseCourseCardTypes(raw: string | null | undefined, section: string): CardTypeDef[] {
  const defaults = defaultCardTypesForSection(section).filter((t) => t.enabled !== false);

  if (raw?.trim()) {
    try {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr) && arr.length > 0) {
        const enabled = arr
          .map(normalizeCardType)
          .filter((t) => t.enabled !== false)
          .sort((a, b) => a.ord - b.ord);
        return enabled.length > 0 ? enabled : defaults;
      }
    } catch {
      /* fall through */
    }
  }
  return defaults;
}

/** Parse tất cả (kể cả disabled) — dùng trong admin */
export function parseAllCourseCardTypes(raw: string | null | undefined, section: string): CardTypeDef[] {
  if (raw?.trim()) {
    try {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.map(normalizeCardType).sort((a, b) => a.ord - b.ord);
      }
    } catch {
      /* fall through */
    }
  }
  return defaultCardTypesForSection(section);
}

export function serializeCourseCardTypes(types: CardTypeDef[]): string {
  return JSON.stringify(
    types.map((t, i) => ({
      id: t.id,
      label: t.label,
      ord: i,
      enabled: t.enabled !== false,
      layout: t.layout ?? inferLayoutFromId(t.id),
      ...(t.layout === "custom" && t.frontTemplate?.trim()
        ? { frontTemplate: t.frontTemplate, backTemplate: t.backTemplate ?? "" }
        : {}),
    })),
  );
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

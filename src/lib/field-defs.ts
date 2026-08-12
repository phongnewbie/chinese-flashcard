import { parseFieldDefs } from "@/lib/fields";
import { DEFAULT_NOTE_TYPE_FIELDS } from "@/lib/anki-note-fields";

export type FieldDefEntry = {
  name: string;
  description?: string;
  fontFamily?: string;
  fontSize?: number;
  sortField?: boolean;
  rtl?: boolean;
  htmlEditor?: boolean;
  collapse?: boolean;
  excludeSearch?: boolean;
};

export const DEFAULT_FIELD_SETTINGS: Omit<FieldDefEntry, "name"> = {
  fontFamily: "Arial",
  fontSize: 20,
  description: "",
  sortField: false,
  rtl: false,
  htmlEditor: false,
  collapse: false,
  excludeSearch: false,
};

/** Font phổ biến trên Windows — giống dropdown Anki */
export const ANKI_FONT_CHOICES = [
  "Arial",
  "Arial Black",
  "Bahnschrift",
  "Calibri",
  "Cambria",
  "Comic Sans MS",
  "Consolas",
  "Courier New",
  "Georgia",
  "Impact",
  "Lucida Sans Unicode",
  "Microsoft Sans Serif",
  "Palatino Linotype",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
  "Yu Gothic UI",
  "MS Gothic",
  "SimSun",
  "KaiTi",
] as const;

function isFieldDefEntry(v: unknown): v is FieldDefEntry {
  return typeof v === "object" && v !== null && typeof (v as FieldDefEntry).name === "string";
}

export function parseFieldDefEntries(raw: string | null | undefined): FieldDefEntry[] {
  if (!raw?.trim()) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length === 0) return [];

    if (typeof arr[0] === "string") {
      return (arr as string[]).map((name) => ({ name, ...DEFAULT_FIELD_SETTINGS }));
    }

    return arr
      .filter(isFieldDefEntry)
      .map((e) => ({
        ...DEFAULT_FIELD_SETTINGS,
        ...e,
        name: e.name.trim(),
      }))
      .filter((e) => e.name);
  } catch {
    return [];
  }
}

export function resolveFieldDefEntries(raw: string | null | undefined): FieldDefEntry[] {
  const parsed = parseFieldDefEntries(raw);
  if (parsed.length > 0) return parsed;
  return DEFAULT_NOTE_TYPE_FIELDS.map((name) => ({
    name,
    ...DEFAULT_FIELD_SETTINGS,
    sortField: name === "CHỮ HÁN",
  }));
}

export function fieldNamesFromEntries(entries: FieldDefEntry[]): string[] {
  return entries.map((e) => e.name);
}

export function settingsMapFromEntries(entries: FieldDefEntry[]): Record<string, Omit<FieldDefEntry, "name">> {
  const map: Record<string, Omit<FieldDefEntry, "name">> = {};
  for (const e of entries) {
    const { name, ...rest } = e;
    map[name] = rest;
  }
  return map;
}

export function serializeFieldDefEntries(entries: FieldDefEntry[]): string {
  return JSON.stringify(entries);
}

/** Backward compat — chỉ lấy tên field */
export function resolveFieldNames(raw: string | null | undefined): string[] {
  const entries = resolveFieldDefEntries(raw);
  if (entries.length > 0) return fieldNamesFromEntries(entries);
  const legacy = parseFieldDefs(raw);
  if (legacy.length > 0) return legacy;
  return [...DEFAULT_NOTE_TYPE_FIELDS];
}

export function getFieldStyle(
  entries: FieldDefEntry[],
  label: string,
): { fontFamily: string; fontSize: number; description: string; rtl: boolean } {
  const e = entries.find((x) => x.name === label);
  return {
    fontFamily: e?.fontFamily ?? DEFAULT_FIELD_SETTINGS.fontFamily!,
    fontSize: e?.fontSize ?? DEFAULT_FIELD_SETTINGS.fontSize!,
    description: e?.description ?? "",
    rtl: e?.rtl ?? false,
  };
}

import { parseExtraFields, parseFieldDefs, stringifyExtraFields } from "@/lib/fields";
import {
  DEFAULT_NOTE_TYPE_FIELDS,
  getFieldStyle,
  resolveFieldDefEntries,
  resolveFieldNames,
  serializeFieldDefEntries,
} from "@/lib/field-defs";
import { getSectionPreset } from "@/lib/section-presets";
import { resolveAudioUrl } from "@/lib/import-cards";
import type { StudySectionId } from "@/lib/sections";

export { DEFAULT_NOTE_TYPE_FIELDS };

/** @deprecated use DEFAULT_NOTE_TYPE_FIELDS */
export const ANKI_HSK_FIELD_ORDER = [...DEFAULT_NOTE_TYPE_FIELDS];

const NOTE_TYPE_LABELS: Record<string, string> = {
  vocabulary: "TỪ VỰNG HSK",
  grammar: "NGỮ PHÁP",
  sentence_order: "SẮP XẾP CÂU",
  common: "GIAO TIẾP THÔNG DỤNG",
};

export const REQUIRED_NOTE_FIELDS = new Set(["Tiếng Trung", "Nghĩa tiếng Việt"]);

const MULTILINE_LABELS = new Set([
  "Nghĩa tiếng Việt",
  "Đặt câu",
  "NGHĨA",
  "VÍ DỤ",
  "ĐẶT CÂU",
  "GIẢI THÍCH",
  "GHI CHÚ",
  "CÁCH NHỚ",
  "CÁCH VIẾT",
]);
const IMAGE_LABELS = new Set(["ẢNH", "Ảnh", "Hình ảnh", "Image", "IMAGE"]);

/** Danh sách field của note type — dùng default nếu chưa lưu */
export function resolveFieldDefs(raw: string | null | undefined): string[] {
  return resolveFieldNames(raw);
}

/** Field defs JSON theo mục học — ưu tiên preset, ghi đè nếu bộ thẻ đúng mục đó */
export function fieldDefsRawForSection(
  section: StudySectionId,
  coursePrimarySection: StudySectionId,
  courseFieldDefsRaw: string | null | undefined,
  localOverride?: string | null,
): string {
  if (section === coursePrimarySection) {
    const raw = localOverride ?? courseFieldDefsRaw;
    if (raw?.trim()) return raw;
  }
  return serializeFieldDefEntries(getSectionPreset(section).fieldDefs);
}

/** Giá trị cột Sort Field theo preset mục học */
export function sortFieldValue(card: FlashcardRecord, section?: string): string {
  const sec = (section ?? card.section) as StudySectionId;
  const preset = getSectionPreset(sec);
  const sortName =
    preset.fieldDefs.find((f) => f.sortField)?.name ?? preset.fieldDefs[0]?.name ?? "Front";
  const rows = buildNoteFieldRows(card, serializeFieldDefEntries(preset.fieldDefs));
  const row = rows.find((r) => r.label === sortName);
  return row?.value?.trim() || card.front?.trim() || "";
}

export function sortFieldLabel(section: StudySectionId): string {
  const preset = getSectionPreset(section);
  return preset.fieldDefs.find((f) => f.sortField)?.name ?? preset.fieldDefs[0]?.name ?? "Sort";
}

export type NoteFieldRow = {
  key: string;
  label: string;
  value: string;
  multiline: boolean;
  isImage?: boolean;
  fontFamily?: string;
  fontSize?: number;
  placeholder?: string;
  rtl?: boolean;
};

export type FlashcardRecord = {
  id: string;
  section: string;
  front: string;
  back: string;
  pinyin: string | null;
  audioUrl: string | null;
  extraFields: string | null;
  sortOrder: number;
  flag?: number;
  subdeck?: string | null;
  cardCount?: number;
  tags?: string;
};

const CORE_MAP: Record<string, { key: string; multiline?: boolean }> = {
  "Tiếng Trung": { key: "front" },
  "CHỮ HÁN": { key: "front" },
  "CẤU TRÚC": { key: "front" },
  "MẢNH CÂU": { key: "front" },
  "TÌNH HUỐNG": { key: "front" },
  Pinyin: { key: "pinyin" },
  PINYIN: { key: "pinyin" },
  "Nghĩa tiếng Việt": { key: "back", multiline: true },
  NGHĨA: { key: "back", multiline: true },
  "GIẢI THÍCH": { key: "back", multiline: true },
  "CÂU ĐÚNG": { key: "back", multiline: true },
  "CÂU TRẢ LỜI": { key: "back" },
  "ÂM THANH": { key: "audioUrl" },
};

/** Khóa extraFields cũ → tên field mới */
const LEGACY_EXTRA_KEYS: Record<string, string[]> = {
  "Nghĩa hán việt": ["HÁN VIỆT", "Nghĩa hán việt"],
  "Loại từ": ["LOẠI TỪ", "Loại từ"],
  "Đặt câu": ["ĐẶT CÂU", "Đặt câu", "VÍ DỤ"],
};

export function buildNoteFieldRows(
  card: FlashcardRecord,
  fieldDefsInput: string[] | string | null | undefined,
): NoteFieldRow[] {
  const extras = parseExtraFields(card.extraFields);
  const entries = typeof fieldDefsInput === "string" || fieldDefsInput == null
    ? resolveFieldDefEntries(fieldDefsInput)
    : resolveFieldDefEntries(
        fieldDefsInput.length ? JSON.stringify(fieldDefsInput.map((name) => ({ name }))) : null,
      );
  const defs = fieldDefsInput && Array.isArray(fieldDefsInput)
    ? fieldDefsInput
    : entries.map((e) => e.name);
  const seen = new Set<string>();
  const rows: NoteFieldRow[] = [];

  for (const label of defs) {
    if (seen.has(label) || label === "Tags") continue;
    seen.add(label);
    const style = getFieldStyle(entries, label);
    rows.push({
      ...fieldRowForLabel(card, extras, label),
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      placeholder: style.description || undefined,
      rtl: style.rtl,
    });
  }

  for (const label of Object.keys(extras)) {
    if (seen.has(label) || label === "Tags" || label === "tags") continue;
    seen.add(label);
    const style = getFieldStyle(entries, label);
    rows.push({
      ...fieldRowForLabel(card, extras, label),
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      placeholder: style.description || undefined,
      rtl: style.rtl,
    });
  }

  return rows;
}

function fieldRowForLabel(
  card: FlashcardRecord,
  extras: Record<string, string>,
  label: string,
): NoteFieldRow {
  const core = CORE_MAP[label];
  if (core) {
    const value =
      core.key === "front"
        ? card.front
        : core.key === "back"
          ? card.back
          : core.key === "pinyin"
            ? card.pinyin ?? ""
            : card.audioUrl
              ? `[sound:${card.audioUrl.replace(/^.*\//, "")}]`
              : "";
    return {
      key: core.key,
      label,
      value,
      multiline: !!core.multiline,
    };
  }

  return {
    key: `extra:${label}`,
    label,
    value: lookupExtra(extras, label),
    multiline: MULTILINE_LABELS.has(label),
    isImage: IMAGE_LABELS.has(label),
  };
}

function lookupExtra(extras: Record<string, string>, label: string): string {
  if (extras[label]?.trim()) return extras[label];
  for (const alt of LEGACY_EXTRA_KEYS[label] ?? []) {
    if (extras[alt]?.trim()) return extras[alt];
  }
  return "";
}

export function noteFieldsToCardPayload(
  section: string,
  fields: NoteFieldRow[],
): {
  section: string;
  front: string;
  back: string;
  pinyin: string | null;
  audioUrl: string | null;
  extraFields: string | null;
} {
  const get = (key: string) => fields.find((f) => f.key === key)?.value.trim() ?? "";
  const getLabel = (label: string) =>
    fields.find((f) => f.label === label)?.value.trim() ?? "";

  const extras: Record<string, string> = {};
  for (const f of fields) {
    if (f.key.startsWith("extra:") && f.value.trim()) {
      extras[f.label] = f.value.trim();
    }
  }

  let audio = get("audioUrl");
  if (audio.startsWith("[sound:")) {
    audio = audio.replace(/^\[sound:([^\]]+)\]$/, "$1");
  }
  const hanViet = getLabel("Nghĩa hán việt") || getLabel("HÁN VIỆT");
  const soundInHanViet = hanViet.match(/\[sound:([^\]]+)\]/);
  if (!audio && soundInHanViet) audio = soundInHanViet[1];

  return {
    section,
    front: get("front") || getLabel("Tiếng Trung") || getLabel("CHỮ HÁN"),
    back: get("back") || getLabel("Nghĩa tiếng Việt") || getLabel("NGHĨA"),
    pinyin: get("pinyin") || getLabel("Pinyin") || getLabel("PINYIN") || null,
    audioUrl: audio ? (resolveAudioUrl(audio, "/uploads/audio") ?? null) : null,
    extraFields: stringifyExtraFields(extras),
  };
}

export function noteTypeLabel(section: string): string {
  return NOTE_TYPE_LABELS[section] ?? section;
}

export function getTags(card: FlashcardRecord): string {
  const extras = parseExtraFields(card.extraFields);
  return extras.Tags ?? extras.tags ?? "";
}

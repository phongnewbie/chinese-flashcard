import type { FieldDefEntry } from "@/lib/field-defs";
import { DEFAULT_FIELD_SETTINGS, resolveFieldDefEntries, serializeFieldDefEntries } from "@/lib/field-defs";
import type { HskCategoryId } from "@/lib/hsk-levels";

export type SectionPreset = {
  noteTypeLabel: string;
  fieldDefs: FieldDefEntry[];
  frontTemplate: string;
  backTemplate: string;
  cardCss: string;
  cardTypes: { id: string; label: string; ord: number }[];
};

function field(
  name: string,
  patch: Partial<Omit<FieldDefEntry, "name">> = {},
): FieldDefEntry {
  return { name, ...DEFAULT_FIELD_SETTINGS, ...patch };
}

const BASE_CARD_CSS = `.card {
  text-align: center;
  padding: 1.5rem 1.25rem;
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.card .hint {
  margin-top: auto;
  padding-top: 1.25rem;
  flex-shrink: 0;
}
.hanzi, .hanzi-ref, .answer-cn {
  font-size: clamp(2rem, 6vw, 2.75rem);
  font-weight: 600;
  color: #1c1917;
  line-height: 1.3;
  text-align: center;
  width: 100%;
}
.card.back .meaning,
.card.front .meaning {
  font-size: clamp(2rem, 6vw, 2.75rem);
  color: #1c1917;
  font-weight: 600;
  line-height: 1.35;
  text-align: center;
  width: 100%;
}
.explain {
  font-size: clamp(2rem, 6vw, 2.75rem);
  color: #1c1917;
  font-weight: 600;
  line-height: 1.35;
  text-align: center;
  width: 100%;
}
.pinyin {
  font-size: clamp(1.125rem, 3.5vw, 1.35rem);
  color: #78716c;
  margin-top: 0.5rem;
  text-align: center;
  width: 100%;
}
.meta-row {
  font-size: 1rem;
  color: #57534e;
  margin-top: 0.5rem;
  text-align: left;
}
.example, .note {
  font-size: 1rem;
  color: #57534e;
  margin-top: 0.85rem;
  text-align: left;
  line-height: 1.6;
  white-space: pre-line;
}
.hint {
  font-size: 0.75rem;
  color: #a8a29e;
  margin-top: 1.5rem;
}
.hanzi-ref {
  font-size: 2rem;
  margin-top: 0.85rem;
  opacity: 0.85;
}`;

/** Từ vựng — đúng thứ tự cột Excel */
const VOCAB_FIELDS = {
  chinese: "Tiếng Trung",
  pinyin: "Pinyin",
  hanViet: "Nghĩa hán việt",
  pos: "Loại từ",
  meaning: "Nghĩa tiếng Việt",
  example: "Đặt câu",
} as const;

const VOCABULARY_PRESET: SectionPreset = {
  noteTypeLabel: "TỪ VỰNG HSK",
  fieldDefs: [
    field(VOCAB_FIELDS.chinese, { sortField: true, fontSize: 28 }),
    field(VOCAB_FIELDS.pinyin, { fontSize: 18 }),
    field(VOCAB_FIELDS.hanViet),
    field(VOCAB_FIELDS.pos),
    field(VOCAB_FIELDS.meaning, { fontSize: 20, htmlEditor: true }),
    field(VOCAB_FIELDS.example, { htmlEditor: true, collapse: false }),
    field("ẢNH", { description: "Paste ảnh trực tiếp (Ctrl+V)" }),
    field("ÂM THANH", { description: "Link mp3 (https://…), [sound:ten.mp3] hoặc tên file đã upload" }),
  ],
  frontTemplate: `<div class="card front">
  <div class="meaning">{{${VOCAB_FIELDS.meaning}}}</div>
  {{#${VOCAB_FIELDS.pos}}}<div class="meta-row"><strong>Loại từ:</strong> {{${VOCAB_FIELDS.pos}}}</div>{{/${VOCAB_FIELDS.pos}}}
  {{#ẢNH}}<div class="card-image">{{ẢNH}}</div>{{/ẢNH}}
  {{#Audio}}<div class="card-audio">{{Audio}}</div>{{/Audio}}
  <p class="hint">Enter / Space — lật thẻ</p>
</div>`,
  backTemplate: `<div class="card back">
  <div class="hanzi">{{${VOCAB_FIELDS.chinese}}}</div>
  {{#${VOCAB_FIELDS.pinyin}}}<div class="pinyin">{{${VOCAB_FIELDS.pinyin}}}</div>{{/${VOCAB_FIELDS.pinyin}}}
  {{#${VOCAB_FIELDS.hanViet}}}<div class="meta-row"><strong>Hán Việt:</strong> {{${VOCAB_FIELDS.hanViet}}}</div>{{/${VOCAB_FIELDS.hanViet}}}
  {{#${VOCAB_FIELDS.pos}}}<div class="meta-row"><strong>Loại từ:</strong> {{${VOCAB_FIELDS.pos}}}</div>{{/${VOCAB_FIELDS.pos}}}
  <div class="meaning">{{${VOCAB_FIELDS.meaning}}}</div>
  {{#ẢNH}}<div class="card-image">{{ẢNH}}</div>{{/ẢNH}}
  {{#${VOCAB_FIELDS.example}}}<div class="example"><strong>Đặt câu:</strong><br>{{${VOCAB_FIELDS.example}}}</div>{{/${VOCAB_FIELDS.example}}}
  {{#Audio}}<div class="card-audio">{{Audio}}</div>{{/Audio}}
</div>`,
  cardCss: BASE_CARD_CSS,
  cardTypes: [
    { id: "viet_trung", label: "Việt → Trung", ord: 0 },
    { id: "trung_viet", label: "Trung → Việt", ord: 1 },
  ],
};

/** Ngữ pháp — 7 cột Excel + MÃ + ÂM THANH (không có ẢNH) */
const GRAMMAR_PRESET: SectionPreset = {
  noteTypeLabel: "NGỮ PHÁP",
  fieldDefs: [
    field("CHỮ HÁN", { sortField: true, fontSize: 24, description: "Câu tiếng Trung" }),
    field("PINYIN", { fontSize: 18 }),
    field("NGHĨA TIẾNG VIỆT", { fontSize: 20, description: "Nghĩa tiếng Việt", htmlEditor: true }),
    field("CẤU TRÚC", { fontSize: 18, description: "Công thức ngữ pháp", htmlEditor: true }),
    field("CÁCH DÙNG", { fontSize: 18, description: "Cách dùng", htmlEditor: true }),
    field("ĐIỂM NGỮ PHÁP", { fontSize: 18, description: "Điểm ngữ pháp", htmlEditor: true }),
    field("MÃ", { fontSize: 14, description: "Cột STT cuối file (NP1, NP2…)" }),
    field("ÂM THANH", { description: "Link mp3 hoặc [sound:ten-file.mp3]" }),
  ],
  frontTemplate: `<div class="card front">
  <div class="answer-cn">{{CHỮ HÁN}}</div>
  {{#PINYIN}}<div class="pinyin">{{PINYIN}}</div>{{/PINYIN}}
  {{#ÂM THANH}}<div class="card-audio">{{ÂM THANH}}</div>{{/ÂM THANH}}
  <p class="hint">Enter / Space — lật thẻ</p>
</div>`,
  backTemplate: `<div class="card back">
  <div class="meaning">{{NGHĨA TIẾNG VIỆT}}</div>
  {{#PINYIN}}<div class="pinyin">{{PINYIN}}</div>{{/PINYIN}}
  {{#CẤU TRÚC}}<div class="example"><strong>Cấu trúc:</strong> {{CẤU TRÚC}}</div>{{/CẤU TRÚC}}
  {{#CÁCH DÙNG}}<div class="note"><strong>Cách dùng:</strong> {{CÁCH DÙNG}}</div>{{/CÁCH DÙNG}}
  {{#ĐIỂM NGỮ PHÁP}}<div class="note"><strong>Điểm ngữ pháp:</strong> {{ĐIỂM NGỮ PHÁP}}</div>{{/ĐIỂM NGỮ PHÁP}}
  {{#ÂM THANH}}<div class="card-audio">{{ÂM THANH}}</div>{{/ÂM THANH}}
</div>`,
  cardCss: BASE_CARD_CSS,
  cardTypes: [{ id: "trung_viet", label: "Trung → Việt", ord: 0 }],
};

/** Sắp xếp câu */
const SENTENCE_ORDER_PRESET: SectionPreset = {
  noteTypeLabel: "SẮP XẾP CÂU",
  fieldDefs: [
    field("MẢNH CÂU", { sortField: true, fontSize: 22, description: "Các mảnh — cách nhau bằng | hoặc /" }),
    field("CÂU ĐÚNG", { fontSize: 24, description: "Câu đúng sau khi sắp xếp" }),
    field("PINYIN", { fontSize: 18 }),
    field("NGHĨA", { description: "Nghĩa tiếng Việt" }),
    field("GHI CHÚ", { collapse: true }),
    field("ẢNH", { description: "Paste ảnh trực tiếp (Ctrl+V)" }),
  ],
  frontTemplate: `<div class="card front">
  <div class="example"><strong>Sắp xếp các mảnh:</strong><br>{{Front}}</div>
  {{#NGHĨA}}<div class="meta-row">{{NGHĨA}}</div>{{/NGHĨA}}
  {{#ẢNH}}<div class="card-image">{{ẢNH}}</div>{{/ẢNH}}
  {{#Audio}}<div class="card-audio">{{Audio}}</div>{{/Audio}}
  <p class="hint">Enter / Space — lật thẻ</p>
</div>`,
  backTemplate: `<div class="card back">
  <div class="answer-cn">{{Back}}</div>
  {{#Pinyin}}<div class="pinyin">{{Pinyin}}</div>{{/Pinyin}}
  {{#ẢNH}}<div class="card-image">{{ẢNH}}</div>{{/ẢNH}}
  {{#NGHĨA}}<div class="meaning">{{NGHĨA}}</div>{{/NGHĨA}}
  {{#GHI CHÚ}}<div class="note">{{GHI CHÚ}}</div>{{/GHI CHÚ}}
  {{#Audio}}<div class="card-audio">{{Audio}}</div>{{/Audio}}
</div>`,
  cardCss: BASE_CARD_CSS,
  cardTypes: [{ id: "default", label: "Default", ord: 0 }],
};

/** Giao tiếp thông dụng */
const COMMON_PRESET: SectionPreset = {
  noteTypeLabel: "GIAO TIẾP THÔNG DỤNG",
  fieldDefs: [
    field("TÌNH HUỐNG", { sortField: true, fontSize: 20, description: "Tình huống / câu hỏi tiếng Việt" }),
    field("CÂU TRẢ LỜI", { fontSize: 24, description: "Cụm / câu tiếng Trung" }),
    field("PINYIN", { fontSize: 18 }),
    field("VÍ DỤ", { description: "Hội thoại mẫu", htmlEditor: true }),
    field("GHI CHÚ", { collapse: true }),
    field("ẢNH", { description: "Paste ảnh trực tiếp (Ctrl+V)" }),
    field("ÂM THANH"),
  ],
  frontTemplate: `<div class="card front">
  <div class="explain">{{Front}}</div>
  {{#ẢNH}}<div class="card-image">{{ẢNH}}</div>{{/ẢNH}}
  {{#Audio}}<div class="card-audio">{{Audio}}</div>{{/Audio}}
  <p class="hint">Enter / Space — lật thẻ</p>
</div>`,
  backTemplate: `<div class="card back">
  <div class="answer-cn">{{Back}}</div>
  {{#Pinyin}}<div class="pinyin">{{Pinyin}}</div>{{/Pinyin}}
  {{#ẢNH}}<div class="card-image">{{ẢNH}}</div>{{/ẢNH}}
  {{#VÍ DỤ}}<div class="example"><strong>Ví dụ:</strong><br>{{VÍ DỤ}}</div>{{/VÍ DỤ}}
  {{#GHI CHÚ}}<div class="note">{{GHI CHÚ}}</div>{{/GHI CHÚ}}
  {{#Audio}}<div class="card-audio">{{Audio}}</div>{{/Audio}}
</div>`,
  cardCss: BASE_CARD_CSS,
  cardTypes: [{ id: "viet_trung", label: "Việt → Trung", ord: 0 }],
};

const PRESETS: Record<HskCategoryId, SectionPreset> = {
  vocabulary: VOCABULARY_PRESET,
  grammar: GRAMMAR_PRESET,
  sentence_order: SENTENCE_ORDER_PRESET,
  common: COMMON_PRESET,
};

export function getSectionPreset(section: string): SectionPreset {
  const key = section as HskCategoryId;
  return PRESETS[key] ?? VOCABULARY_PRESET;
}

export function courseDefaultsForSection(section: string) {
  const preset = getSectionPreset(section);
  return {
    fieldDefs: serializeFieldDefEntries(preset.fieldDefs),
    frontTemplate: preset.frontTemplate,
    backTemplate: preset.backTemplate,
    cardCss: preset.cardCss,
    cardTypes: JSON.stringify(preset.cardTypes),
  };
}

/** Gộp trường preset còn thiếu (vd: ÂM THANH) vào fieldDefs đã lưu */
export function resolveFieldDefEntriesForCourse(
  section: string,
  fieldDefsRaw: string | null | undefined,
): FieldDefEntry[] {
  const preset = getSectionPreset(section);
  if (courseNeedsPresetFields(section, fieldDefsRaw ?? null)) {
    return preset.fieldDefs;
  }
  const presetNames = new Set(preset.fieldDefs.map((f) => f.name));
  let existing = resolveFieldDefEntries(fieldDefsRaw);
  if (section === "grammar") {
    existing = existing.filter((e) => e.name !== "ẢNH");
  }
  const names = new Set(existing.map((e) => e.name));
  const merged = [...existing];
  for (const presetField of preset.fieldDefs) {
    if (!names.has(presetField.name)) {
      merged.push(presetField);
      names.add(presetField.name);
    }
  }
  if (section === "grammar") {
    return merged.filter((e) => presetNames.has(e.name));
  }
  return merged;
}

export function serializedCourseFieldDefs(
  section: string,
  fieldDefsRaw: string | null | undefined,
): string {
  return serializeFieldDefEntries(resolveFieldDefEntriesForCourse(section, fieldDefsRaw));
}

/** Bộ thẻ cũ / import lỗi — thiếu trường chuẩn của mục học */
export function courseNeedsPresetFields(section: string, fieldDefsRaw: string | null): boolean {
  const anchor = getSectionPreset(section).fieldDefs[0]?.name;
  if (!anchor) return false;
  if (!fieldDefsRaw?.trim()) return true;
  try {
    const arr = JSON.parse(fieldDefsRaw) as unknown;
    if (!Array.isArray(arr) || arr.length === 0) return true;
    const names = arr.map((item) =>
      typeof item === "string" ? item.trim() : (item as { name?: string }).name?.trim() ?? "",
    );
    return !names.includes(anchor) ||
      (section === "vocabulary" && names.includes("CHỮ HÁN")) ||
      (section === "grammar" &&
        (!names.includes("CHỮ HÁN") ||
          !names.includes("CÁCH DÙNG") ||
          !names.includes("ÂM THANH") ||
          names.includes("GIẢI THÍCH") ||
          names.includes("VÍ DỤ") ||
          names.includes("GHI CHÚ") ||
          names.includes("ẢNH")));
  } catch {
    return true;
  }
}

/** Hai trường bắt buộc theo mục học (map vào front/back) */
export function requiredFieldLabels(section: string): { front: string; back: string } {
  const preset = getSectionPreset(section);
  const names = preset.fieldDefs.map((f) => f.name);
  const front =
    names.find((n) => coreFieldForSection(section, n) === "front") ?? names[0] ?? "Front";
  const back =
    names.find((n) => coreFieldForSection(section, n) === "back") ?? names[1] ?? "Back";
  return { front, back };
}

/** Ánh xạ tên cột Excel → tên field chuẩn trong preset */
export const IMPORT_FIELD_ALIASES: Record<string, string> = {
  "tieng trung": "Tiếng Trung",
  "chu han": "Tiếng Trung",
  "han tu": "Tiếng Trung",
  "nghia han viet": "Nghĩa hán việt",
  "han viet": "Nghĩa hán việt",
  "loai tu": "Loại từ",
  "nghia tieng viet": "Nghĩa tiếng Việt",
  "nghia viet": "Nghĩa tiếng Việt",
  "y nghia": "Nghĩa tiếng Việt",
  "dat cau": "Đặt câu",
  "cau vi du": "Đặt câu",
  "vi du": "Ví dụ",
  "cau truc": "CẤU TRÚC",
  "mau cau": "CẤU TRÚC",
  "cach dung": "CÁCH DÙNG",
  "diem ngu phap": "ĐIỂM NGỮ PHÁP",
  "ma ngu phap": "MÃ",
  ma: "MÃ",
  "giai thich": "NGHĨA TIẾNG VIỆT",
  "manh cau": "MẢNH CÂU",
  "cac manh": "MẢNH CÂU",
  "cau dung": "CÂU ĐÚNG",
  "tinh huong": "TÌNH HUỐNG",
  "cau tra loi": "CÂU TRẢ LỜI",
  "cum tu": "CÂU TRẢ LỜI",
  pinyin: "Pinyin",
  "phien am": "Pinyin",
  "phiên âm": "Pinyin",
  "am thanh": "ÂM THANH",
  audio: "ÂM THANH",
  anh: "ẢNH",
  "hinh anh": "ẢNH",
  "ghi chu": "GHI CHÚ",
};

/** Field map vào cột core DB theo mục học */
export function coreFieldForSection(
  section: string,
  canonicalField: string,
): "front" | "back" | "pinyin" | "audioUrl" | null {
  const maps: Record<string, Record<string, "front" | "back" | "pinyin" | "audioUrl">> = {
    vocabulary: {
      "Tiếng Trung": "front",
      "CHỮ HÁN": "front",
      "Nghĩa tiếng Việt": "back",
      NGHĨA: "back",
      Pinyin: "pinyin",
      PINYIN: "pinyin",
      "ÂM THANH": "audioUrl",
    },
    grammar: {
      "CHỮ HÁN": "front",
      "NGHĨA TIẾNG VIỆT": "back",
      PINYIN: "pinyin",
      "ÂM THANH": "audioUrl",
    },
    sentence_order: {
      "MẢNH CÂU": "front",
      "CÂU ĐÚNG": "back",
      PINYIN: "pinyin",
    },
    common: {
      "TÌNH HUỐNG": "front",
      "CÂU TRẢ LỜI": "back",
      PINYIN: "pinyin",
      "ÂM THANH": "audioUrl",
    },
  };
  return maps[section]?.[canonicalField] ?? null;
}

/** Tên trường dùng khi import — ưu tiên fieldDefs của bộ thẻ nếu hợp lệ */
export function importFieldNamesForSection(
  section: string,
  courseFieldDefsRaw?: string | null,
): string[] {
  const entries = resolveFieldDefEntriesForCourse(section, courseFieldDefsRaw);
  if (entries.length > 0) return entries.map((e) => e.name);
  return getSectionPreset(section).fieldDefs.map((f) => f.name);
}

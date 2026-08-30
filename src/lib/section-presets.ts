import type { FieldDefEntry } from "@/lib/field-defs";
import { DEFAULT_FIELD_SETTINGS, serializeFieldDefEntries } from "@/lib/field-defs";
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
  padding: 1rem 1.25rem;
  width: 100%;
  box-sizing: border-box;
}
.hanzi, .hanzi-ref, .answer-cn {
  font-size: 2.25rem;
  font-weight: 600;
  color: #1c1917;
  line-height: 1.3;
}
.meaning, .explain {
  font-size: 1.25rem;
  color: #047857;
  font-weight: 600;
  line-height: 1.5;
  text-align: left;
}
.pinyin {
  font-size: 1.125rem;
  color: #78716c;
  margin-top: 0.35rem;
}
.meta-row {
  font-size: 0.95rem;
  color: #57534e;
  margin-top: 0.5rem;
  text-align: left;
}
.example, .note {
  font-size: 0.95rem;
  color: #57534e;
  margin-top: 0.75rem;
  text-align: left;
  line-height: 1.55;
  white-space: pre-line;
}
.hint {
  font-size: 0.75rem;
  color: #a8a29e;
  margin-top: 1.5rem;
}
.hanzi-ref {
  font-size: 1.65rem;
  margin-top: 0.75rem;
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

/** Ngữ pháp */
const GRAMMAR_PRESET: SectionPreset = {
  noteTypeLabel: "NGỮ PHÁP",
  fieldDefs: [
    field("CẤU TRÚC", { sortField: true, fontSize: 24, description: "Cấu trúc / mẫu câu tiếng Trung" }),
    field("PINYIN", { fontSize: 18 }),
    field("GIẢI THÍCH", { fontSize: 20, description: "Giải thích tiếng Việt", htmlEditor: true }),
    field("VÍ DỤ", { description: "Câu ví dụ — Trung / Pinyin / Việt", htmlEditor: true }),
    field("GHI CHÚ", { htmlEditor: true, collapse: true }),
    field("ẢNH", { description: "Paste ảnh trực tiếp (Ctrl+V)" }),
    field("ÂM THANH"),
  ],
  frontTemplate: `<div class="card front">
  <div class="explain">{{Back}}</div>
  {{#ẢNH}}<div class="card-image">{{ẢNH}}</div>{{/ẢNH}}
  {{#Audio}}<div class="card-audio">{{Audio}}</div>{{/Audio}}
  <p class="hint">Enter / Space — lật thẻ</p>
</div>`,
  backTemplate: `<div class="card back">
  <div class="answer-cn">{{Front}}</div>
  {{#Pinyin}}<div class="pinyin">{{Pinyin}}</div>{{/Pinyin}}
  {{#ẢNH}}<div class="card-image">{{ẢNH}}</div>{{/ẢNH}}
  {{#VÍ DỤ}}<div class="example"><strong>Ví dụ:</strong><br>{{VÍ DỤ}}</div>{{/VÍ DỤ}}
  {{#GHI CHÚ}}<div class="note">{{GHI CHÚ}}</div>{{/GHI CHÚ}}
  {{#Audio}}<div class="card-audio">{{Audio}}</div>{{/Audio}}
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
    return !names.includes(anchor) || (section === "vocabulary" && names.includes("CHỮ HÁN"));
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
  "giai thich": "GIẢI THÍCH",
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
      "CẤU TRÚC": "front",
      "GIẢI THÍCH": "back",
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
  const preset = getSectionPreset(section);
  const presetNames = preset.fieldDefs.map((f) => f.name);

  if (courseFieldDefsRaw?.trim() && !courseNeedsPresetFields(section, courseFieldDefsRaw)) {
    try {
      const arr = JSON.parse(courseFieldDefsRaw) as unknown;
      if (Array.isArray(arr) && arr.length > 0) {
        const names = arr.map((item) =>
          typeof item === "string" ? item.trim() : (item as { name?: string }).name?.trim() ?? "",
        ).filter(Boolean);
        if (names.length > 0) return names;
      }
    } catch {
      /* fallback preset */
    }
  }

  return presetNames;
}

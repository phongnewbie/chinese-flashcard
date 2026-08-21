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
  padding: 1.25rem 1.5rem;
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

/** Từ vựng — khớp cột Excel: Tiếng Trung | Pinyin | Nghĩa hán việt | Loại từ | Nghĩa tiếng Việt | Đặt câu */
const VOCABULARY_PRESET: SectionPreset = {
  noteTypeLabel: "TỪ VỰNG HSK",
  fieldDefs: [
    field("CHỮ HÁN", { sortField: true, fontSize: 28, description: "Tiếng Trung" }),
    field("PINYIN", { fontSize: 18, description: "Phiên âm" }),
    field("HÁN VIỆT", { description: "Nghĩa hán việt" }),
    field("LOẠI TỪ", { description: "Loại từ (Động từ, Danh từ…)" }),
    field("NGHĨA", { fontSize: 20, description: "Nghĩa tiếng Việt", htmlEditor: true }),
    field("ĐẶT CÂU", { description: "Câu ví dụ — Trung / Pinyin / Việt", htmlEditor: true, collapse: false }),
    field("ẢNH", { description: "Link hoặc tên file ảnh" }),
    field("GHI CHÚ", { htmlEditor: true, collapse: true }),
    field("ÂM THANH", { description: "File mp3 hoặc link" }),
  ],
  frontTemplate: `<div class="card front">
  <div class="meaning">{{Back}}</div>
  {{#LOẠI TỪ}}<div class="meta-row"><strong>Loại từ:</strong> {{LOẠI TỪ}}</div>{{/LOẠI TỪ}}
  <p class="hint">Enter / Space — lật thẻ</p>
</div>`,
  backTemplate: `<div class="card back">
  <div class="hanzi">{{Front}}</div>
  {{#Pinyin}}<div class="pinyin">{{Pinyin}}</div>{{/Pinyin}}
  {{#HÁN VIỆT}}<div class="meta-row"><strong>Hán Việt:</strong> {{HÁN VIỆT}}</div>{{/HÁN VIỆT}}
  {{#LOẠI TỪ}}<div class="meta-row"><strong>Loại từ:</strong> {{LOẠI TỪ}}</div>{{/LOẠI TỪ}}
  <div class="meaning">{{Back}}</div>
  {{#ĐẶT CÂU}}<div class="example"><strong>Đặt câu:</strong><br>{{ĐẶT CÂU}}</div>{{/ĐẶT CÂU}}
  {{#ẢNH}}<div class="example">{{ẢNH}}</div>{{/ẢNH}}
  {{#GHI CHÚ}}<div class="note">{{GHI CHÚ}}</div>{{/GHI CHÚ}}
  {{#Audio}}{{Audio}}{{/Audio}}
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
    field("ÂM THANH"),
  ],
  frontTemplate: `<div class="card front">
  <div class="explain">{{Back}}</div>
  <p class="hint">Enter / Space — lật thẻ</p>
</div>`,
  backTemplate: `<div class="card back">
  <div class="answer-cn">{{Front}}</div>
  {{#Pinyin}}<div class="pinyin">{{Pinyin}}</div>{{/Pinyin}}
  {{#VÍ DỤ}}<div class="example"><strong>Ví dụ:</strong><br>{{VÍ DỤ}}</div>{{/VÍ DỤ}}
  {{#GHI CHÚ}}<div class="note">{{GHI CHÚ}}</div>{{/GHI CHÚ}}
  {{#Audio}}{{Audio}}{{/Audio}}
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
  ],
  frontTemplate: `<div class="card front">
  <div class="example"><strong>Sắp xếp các mảnh:</strong><br>{{Front}}</div>
  {{#NGHĨA}}<div class="meta-row">{{NGHĨA}}</div>{{/NGHĨA}}
  <p class="hint">Enter / Space — lật thẻ</p>
</div>`,
  backTemplate: `<div class="card back">
  <div class="answer-cn">{{Back}}</div>
  {{#Pinyin}}<div class="pinyin">{{Pinyin}}</div>{{/Pinyin}}
  {{#NGHĨA}}<div class="meaning">{{NGHĨA}}</div>{{/NGHĨA}}
  {{#GHI CHÚ}}<div class="note">{{GHI CHÚ}}</div>{{/GHI CHÚ}}
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
    field("ÂM THANH"),
  ],
  frontTemplate: `<div class="card front">
  <div class="explain">{{Front}}</div>
  <p class="hint">Enter / Space — lật thẻ</p>
</div>`,
  backTemplate: `<div class="card back">
  <div class="answer-cn">{{Back}}</div>
  {{#Pinyin}}<div class="pinyin">{{Pinyin}}</div>{{/Pinyin}}
  {{#VÍ DỤ}}<div class="example"><strong>Ví dụ:</strong><br>{{VÍ DỤ}}</div>{{/VÍ DỤ}}
  {{#GHI CHÚ}}<div class="note">{{GHI CHÚ}}</div>{{/GHI CHÚ}}
  {{#Audio}}{{Audio}}{{/Audio}}
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

/** Ánh xạ tên cột Excel → tên field chuẩn trong preset */
export const IMPORT_FIELD_ALIASES: Record<string, string> = {
  "tieng trung": "CHỮ HÁN",
  "chu han": "CHỮ HÁN",
  "han tu": "CHỮ HÁN",
  "nghia han viet": "HÁN VIỆT",
  "han viet": "HÁN VIỆT",
  "loai tu": "LOẠI TỪ",
  "nghia tieng viet": "NGHĨA",
  "nghia": "NGHĨA",
  "dat cau": "ĐẶT CÂU",
  "cau vi du": "ĐẶT CÂU",
  "vi du": "VÍ DỤ",
  "cau truc": "CẤU TRÚC",
  "mau cau": "CẤU TRÚC",
  "giai thich": "GIẢI THÍCH",
  "manh cau": "MẢNH CÂU",
  "cac manh": "MẢNH CÂU",
  "cau dung": "CÂU ĐÚNG",
  "tinh huong": "TÌNH HUỐNG",
  "cau tra loi": "CÂU TRẢ LỜI",
  "cum tu": "CÂU TRẢ LỜI",
  "pinyin": "PINYIN",
  "phien am": "PINYIN",
  "am thanh": "ÂM THANH",
  "audio": "ÂM THANH",
  "anh": "ẢNH",
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
      "CHỮ HÁN": "front",
      NGHĨA: "back",
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

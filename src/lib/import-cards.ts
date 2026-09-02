import * as XLSX from "xlsx";
import {
  coreFieldForSection,
  getSectionPreset,
  IMPORT_FIELD_ALIASES,
  importFieldNamesForSection,
  requiredFieldLabels,
} from "@/lib/section-presets";
import {
  parseSectionValue,
  sectionFromSheetName,
  type StudySectionId,
} from "@/lib/sections";
import { firstAudioInText } from "@/lib/anki-sound";

export type ParsedCard = {
  section: StudySectionId;
  front: string;
  back: string;
  pinyin?: string;
  audioUrl?: string;
  extraFields?: Record<string, string>;
};

export type ImportPreview = {
  cards: ParsedCard[];
  total: number;
  bySection: Record<string, number>;
  detectedColumns: string[];
  /** Cột Excel → tên trường trong bộ thẻ */
  columnMapping: Record<string, string>;
  /** Cột Excel không khớp trường nào */
  unmappedColumns: string[];
  expectedFields: string[];
  warnings: string[];
  sample: ParsedCard[];
  /** Số dòng dữ liệu (không tính header / dòng trống) */
  sourceRows?: number;
  skippedRows?: number;
};

export type ImportParseOptions = {
  deckSection?: StudySectionId;
  /** Tên trường đã tạo sẵn trong bộ thẻ (Browse / preset) */
  fieldNames?: string[];
};

/** Chuẩn hóa tên cột (bỏ dấu, gộp khoảng trắng) */
export function normHeader(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[_\-./:：]+/g, " ")
    .replace(/\s+/g, " ");
}

const SKIP_HEADERS = new Set(["stt", "tt", "no", "#", "id", "index", "thu tu", "so thu tu"]);

/** Alias theo mục học — map tên cột Excel → tên field trong preset */
function sectionImportAliases(section: StudySectionId): Record<string, string> {
  if (section === "grammar") {
    return {
      "chu han": "CHỮ HÁN",
      "tieng trung": "CHỮ HÁN",
      "han tu": "CHỮ HÁN",
      "nghia tieng viet": "NGHĨA TIẾNG VIỆT",
      "nghia viet": "NGHĨA TIẾNG VIỆT",
      nghia: "NGHĨA TIẾNG VIỆT",
      "y nghia": "NGHĨA TIẾNG VIỆT",
      "giai thich": "NGHĨA TIẾNG VIỆT",
      "cau truc": "CẤU TRÚC",
      "mau cau": "CẤU TRÚC",
      "cach dung": "CÁCH DÙNG",
      "diem ngu phap": "ĐIỂM NGỮ PHÁP",
      "ma ngu phap": "MÃ",
      ma: "MÃ",
      pinyin: "PINYIN",
      "phien am": "PINYIN",
      "am thanh": "ÂM THANH",
      audio: "ÂM THANH",
    };
  }
  if (section === "common") {
    return {
      "tinh huong": "TÌNH HUỐNG",
      situation: "TÌNH HUỐNG",
      "cum tu": "CÂU TRẢ LỜI",
      "cau tra loi": "CÂU TRẢ LỜI",
      "tieng trung": "CÂU TRẢ LỜI",
      "nghia tieng viet": "TÌNH HUỐNG",
    };
  }
  return {};
}

function resolveAliasTarget(aliasTarget: string, fieldNames: string[]): string | null {
  if (fieldNames.includes(aliasTarget)) return aliasTarget;
  const norm = normHeader(aliasTarget);
  return fieldNames.find((f) => normHeader(f) === norm) ?? null;
}

/** Gán tên cột Excel → đúng tên field trong preset / bộ thẻ */
export function headerToFieldName(
  header: string,
  fieldNames: string[],
  section: StudySectionId = "vocabulary",
): string | null {
  const norm = normHeader(header);
  if (!norm || SKIP_HEADERS.has(norm)) return null;

  for (const name of fieldNames) {
    if (normHeader(name) === norm) return name;
  }

  const sectionAlias = sectionImportAliases(section)[norm];
  if (sectionAlias && fieldNames.includes(sectionAlias)) return sectionAlias;

  const aliasTarget = IMPORT_FIELD_ALIASES[norm];
  if (aliasTarget) {
    const resolved = resolveAliasTarget(aliasTarget, fieldNames);
    if (resolved) return resolved;
  }

  let best: { field: string; score: number } | null = null;

  for (const [alias, target] of Object.entries({ ...IMPORT_FIELD_ALIASES, ...sectionImportAliases(section) })) {
    const resolved = resolveAliasTarget(target, fieldNames);
    if (!resolved) continue;
    if (norm === alias) {
      return resolved;
    }
    if (alias.length >= 4 && (norm.includes(alias) || alias.includes(norm))) {
      const score = alias.length + (norm === alias ? 100 : 0);
      if (!best || score > best.score) best = { field: resolved, score };
    }
  }

  for (const name of fieldNames) {
    const fn = normHeader(name);
    if (norm.includes(fn) || fn.includes(norm)) {
      const score = fn.length;
      if (!best || score > best.score) best = { field: name, score };
    }
  }

  return best?.field ?? null;
}

export type ColumnMapping = Map<number, string>;

/** Mỗi cột Excel → một trường (không trùng) */
export function buildColumnMapping(
  headers: string[],
  fieldNames: string[],
  section: StudySectionId = "vocabulary",
): ColumnMapping {
  const candidates: { colIdx: number; header: string; field: string; score: number }[] = [];

  headers.forEach((header, colIdx) => {
    let field = headerToFieldName(header, fieldNames, section);
    const norm = normHeader(header);
    // Cột STT thứ 2 trong file ngữ pháp (NP1, NP2…) → MÃ
    if (
      !field &&
      section === "grammar" &&
      norm === "stt" &&
      colIdx > 0 &&
      fieldNames.includes("MÃ")
    ) {
      field = "MÃ";
    }
    if (!field) return;
    const exact = norm === normHeader(field) ? 200 : 0;
    const aliasExact = IMPORT_FIELD_ALIASES[norm] ? 150 : 0;
    candidates.push({
      colIdx,
      header: header.trim(),
      field,
      score: exact + aliasExact + norm.length,
    });
  });

  candidates.sort((a, b) => b.score - a.score);

  const map: ColumnMapping = new Map();
  const usedFields = new Set<string>();
  for (const c of candidates) {
    if (usedFields.has(c.field)) continue;
    usedFields.add(c.field);
    map.set(c.colIdx, c.field);
  }

  return map;
}

function mappingToRecord(headers: string[], map: ColumnMapping): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [colIdx, field] of map.entries()) {
    const header = headers[colIdx]?.trim() || `Cột ${colIdx + 1}`;
    out[header] = field;
  }
  return out;
}

function rowLooksLikeHeader(cells: string[], fieldNames: string[], section: StudySectionId): boolean {
  let hits = 0;
  for (const cell of cells) {
    const trimmed = cell.trim();
    if (!trimmed || trimmed.length > 35) continue;
    const norm = normHeader(trimmed);
    if (fieldNames.some((f) => normHeader(f) === norm)) {
      hits++;
      continue;
    }
    const alias = sectionImportAliases(section)[norm] ?? IMPORT_FIELD_ALIASES[norm];
    if (alias && fieldNames.some((f) => normHeader(f) === normHeader(alias))) {
      hits++;
    }
  }
  return hits >= 2;
}

function fieldsFromMappedRow(
  rowArr: string[],
  map: ColumnMapping,
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [colIdx, fieldName] of map.entries()) {
    const val = String(rowArr[colIdx] ?? "").trim();
    if (val) fields[fieldName] = val;
  }
  return fields;
}

/** Gom giá trị theo tên field → front/back/pinyin/extra */
function applyPresetFields(
  section: StudySectionId,
  fields: Record<string, string>,
): ParsedCard | null {
  const { front: frontLabel, back: backLabel } = requiredFieldLabels(section);

  let front = "";
  let back = "";
  let pinyin = "";
  let audioUrl = "";
  const extraFields: Record<string, string> = {};

  for (const [name, value] of Object.entries(fields)) {
    if (!value.trim()) continue;
    const core = coreFieldForSection(section, name);
    if (core === "front") front = value.trim();
    else if (core === "back") back = value.trim();
    else if (core === "pinyin") pinyin = value.trim();
    else if (core === "audioUrl") audioUrl = value.trim();
    else extraFields[name] = value.trim();
  }

  if (!front && fields[frontLabel]) front = fields[frontLabel].trim();
  if (!back && fields[backLabel]) back = fields[backLabel].trim();

  if (/^\d+$/.test(front) && front.length <= 4) {
    const structure = fields[frontLabel]?.trim() ?? fields["CHỮ HÁN"]?.trim() ?? "";
    if (!structure || /^\d+$/.test(structure)) front = "";
  }

  if (section === "grammar") {
    if (!front) front = fields["CHỮ HÁN"]?.trim() || "";
    if (!back) {
      back =
        fields["NGHĨA TIẾNG VIỆT"]?.trim() ||
        fields["GIẢI THÍCH"]?.trim() ||
        "";
    }
    if (front && !back) back = fields["NGHĨA TIẾNG VIỆT"]?.trim() || front;
    if (back && !front) front = fields["CHỮ HÁN"]?.trim() || back;
  }

  if (!front && !back) return null;
  if (!front || !back) {
    if (section === "grammar" || section === "common") {
      if (!front) front = back;
      if (!back) back = front;
    } else {
      return null;
    }
  }
  if (/^\d+$/.test(front) && front.length <= 4 && !back.trim()) return null;

  if (!audioUrl) {
    for (const value of Object.values(fields)) {
      const found = firstAudioInText(value);
      if (found) {
        audioUrl = found;
        break;
      }
    }
  }

  if (section === "grammar" && !audioUrl && extraFields["MÃ"]?.trim()) {
    audioUrl = `[sound:${extraFields["MÃ"].trim()}]`;
  }

  return {
    section,
    front,
    back,
    pinyin: pinyin || undefined,
    audioUrl: audioUrl || undefined,
    extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
  };
}

function positionalRowByPreset(
  rowArr: string[],
  section: StudySectionId,
  fieldNames: string[],
  columnMap?: ColumnMapping,
): ParsedCard | null {
  const preset = getSectionPreset(section);
  const names = fieldNames.length ? fieldNames : preset.fieldDefs.map((f) => f.name);
  const values: Record<string, string> = {};

  if (columnMap && columnMap.size > 0) {
    for (const [colIdx, fieldName] of columnMap.entries()) {
      const val = String(rowArr[colIdx] ?? "").trim();
      if (val) values[fieldName] = val;
    }
  } else {
    let startCol = 0;
    const firstCell = String(rowArr[0] ?? "").trim();
    if (/^\d+$/.test(firstCell) && firstCell.length <= 4) startCol = 1;
    const limit = Math.min(rowArr.length, names.length + startCol);
    for (let col = startCol; col < limit; col++) {
      const val = String(rowArr[col] ?? "").trim();
      if (!val || SKIP_HEADERS.has(normHeader(val))) continue;
      const nameIdx = col - startCol;
      if (names[nameIdx]) values[names[nameIdx]!] = val;
    }
  }

  if (Object.keys(values).length < 1) return null;
  return applyPresetFields(section, values);
}

function rowToCard(
  rowArr: string[],
  section: StudySectionId,
  columnMap: ColumnMapping,
  fieldNames: string[],
): ParsedCard | null {
  const mapped = fieldsFromMappedRow(rowArr, columnMap);
  if (Object.keys(mapped).length >= 1) {
    const card = applyPresetFields(section, mapped);
    if (card) return card;
  }
  const positional = positionalRowByPreset(rowArr, section, fieldNames, columnMap);
  if (positional) return positional;
  return positionalRowByPreset(rowArr, section, fieldNames);
}

function findHeaderRow(
  rawRows: string[][],
  fieldNames: string[],
  section: StudySectionId,
): number {
  if (rawRows.length === 0) return 0;
  const row0 = ((rawRows[0] as string[]) || []).map((c) => String(c ?? "").trim());
  if (rowLooksLikeHeader(row0, fieldNames, section)) return 0;

  for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;
    const cells = row.map((c) => String(c ?? "").trim());
    const nonEmpty = cells.filter(Boolean);
    if (nonEmpty.length < 2) continue;
    if (rowLooksLikeHeader(cells, fieldNames, section)) return r;
  }
  return 0;
}

export function parseExcelBuffer(
  buffer: ArrayBuffer,
  options: ImportParseOptions = {},
): {
  cards: ParsedCard[];
  columnMapping: Record<string, string>;
  expectedFields: string[];
  unmappedColumns: string[];
  sourceRows: number;
  skippedRows: number;
} {
  const deckSection = options.deckSection ?? "vocabulary";
  const fieldNames =
    options.fieldNames?.length
      ? options.fieldNames
      : importFieldNamesForSection(deckSection);

  const wb = XLSX.read(buffer, { type: "array" });
  const cards: ParsedCard[] = [];
  let columnMapping: Record<string, string> = {};
  let unmappedColumns: string[] = [];
  let sourceRows = 0;
  let skippedRows = 0;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const sheetSection = options.deckSection ?? sectionFromSheetName(sheetName) ?? deckSection;
    const sheetFieldNames =
      options.fieldNames?.length
        ? options.fieldNames
        : importFieldNamesForSection(sheetSection);

    const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
    if (rawRows.length === 0) continue;

    const headerIdx = findHeaderRow(rawRows as string[][], sheetFieldNames, sheetSection);
    const headers = ((rawRows[headerIdx] as string[]) || []).map((h) => String(h ?? "").trim());
    const columnMap = buildColumnMapping(headers, sheetFieldNames, sheetSection);

    if (columnMap.size > 0 && Object.keys(columnMapping).length === 0) {
      columnMapping = mappingToRecord(headers, columnMap);
      unmappedColumns = headers
        .map((h, i) => ({ h: h.trim(), i }))
        .filter(({ h, i }) => h && !columnMap.has(i))
        .map(({ h }) => h);
    }

    for (let i = headerIdx + 1; i < rawRows.length; i++) {
      const rowArr = rawRows[i] as string[];
      if (!Array.isArray(rowArr)) continue;

      const hasData = rowArr.some((c) => String(c ?? "").trim());
      if (!hasData) continue;

      sourceRows++;

      const card = rowToCard(rowArr, sheetSection, columnMap, sheetFieldNames);
      if (card) cards.push({ ...card, section: options.deckSection ?? card.section });
      else skippedRows++;
    }
  }

  return { cards, columnMapping, expectedFields: fieldNames, unmappedColumns, sourceRows, skippedRows };
}

function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((s) => s.trim());
  if (line.includes("|")) return line.split("|").map((s) => s.trim());
  if (line.includes(";")) return line.split(";").map((s) => s.trim());
  return line.split(",").map((s) => s.trim());
}

const SECTION_LIKE =
  /^(vocabulary|grammar|sentence_order|common|tu_vung|ngu_phap|sap_xep_cau|thong_dung|từ vựng|ngữ pháp|sắp xếp|thông dụng|[1-4])$/i;

const BRACKET_SECTION = /^\[(.+)\]$/;

function isSectionToken(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (SECTION_LIKE.test(v)) return true;
  return ["tu_vung", "ngu_phap", "sap_xep_cau", "thong_dung"].includes(v);
}

function isHeaderLine(parts: string[], fieldNames: string[], section: StudySectionId): boolean {
  if (parts.length < 2) return false;
  let hits = 0;
  for (const p of parts) {
    if (p.trim() && headerToFieldName(p, fieldNames, section)) hits++;
  }
  return hits >= 2;
}

function parseLabeledLine(line: string): Partial<ParsedCard> | null {
  const q = line.match(/(?:câu hỏi|cau hoi|question|đề|de)\s*[:：]\s*(.+?)(?=(?:đáp án|dap an|answer|trả lời|tra loi)\s*[:：]|$)/i);
  const a = line.match(/(?:đáp án|dap an|answer|trả lời|tra loi)\s*[:：]\s*(.+)$/i);
  if (q && a) {
    return { front: q[1].trim(), back: a[1].trim() };
  }
  return null;
}

/** Notepad / .txt — tab, |, ;, phần [tu_vung], dòng câu hỏi: ... đáp án: ... */
export function parseNotepadText(
  text: string,
  section: StudySectionId = "vocabulary",
  fieldNames?: string[],
): ParsedCard[] {
  const names = fieldNames?.length ? fieldNames : importFieldNamesForSection(section);
  const lines = text.split(/\r?\n/);
  const cards: ParsedCard[] = [];
  let currentSection: StudySectionId = "vocabulary";

  for (let raw of lines) {
    raw = raw.trim();
    if (!raw || /^#/.test(raw)) continue;

    const bracket = raw.match(BRACKET_SECTION);
    if (bracket) {
      currentSection = parseSectionValue(bracket[1]);
      continue;
    }

    const labeled = parseLabeledLine(raw);
    if (labeled?.front && labeled?.back) {
      cards.push({
        section: currentSection,
        front: labeled.front,
        back: labeled.back,
      });
      continue;
    }

    const parts = splitLine(raw);
    if (parts.length < 2) continue;
    if (isHeaderLine(parts, names, currentSection)) continue;

    let section = currentSection;
    let offset = 0;
    if (parts.length >= 3 && isSectionToken(parts[0])) {
      section = parseSectionValue(parts[0]);
      offset = 1;
    }

    const rest = parts.slice(offset);
    if (rest.length < 2) continue;

    const positional = positionalRowByPreset(rest, section, names);
    if (positional) {
      cards.push({ ...positional, section });
      continue;
    }

    const front = rest[0];
    const back = rest[1];
    const pinyin = rest[2];
    const audioUrl = rest[3];

    if (!front || !back) continue;

    cards.push({
      section,
      front,
      back,
      pinyin: pinyin || undefined,
      audioUrl: audioUrl || undefined,
    });
  }
  return cards;
}

export function parseImportFile(
  buffer: ArrayBuffer,
  fileName: string,
  options?: ImportParseOptions | StudySectionId,
): ImportPreview {
  const opts: ImportParseOptions =
    typeof options === "string" ? { deckSection: options } : (options ?? {});

  const section = opts.deckSection ?? "vocabulary";
  const fieldNames =
    opts.fieldNames?.length
      ? opts.fieldNames
      : importFieldNamesForSection(section);

  const lower = fileName.toLowerCase();
  const warnings: string[] = [];
  let cards: ParsedCard[] = [];
  let columnMapping: Record<string, string> = {};
  let detectedColumns: string[] = [];
  let unmappedColumns: string[] = [];
  let sourceRows = 0;
  let skippedRows = 0;

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    const parsed = parseExcelBuffer(buffer, { ...opts, deckSection: section, fieldNames });
    cards = parsed.cards;
    columnMapping = parsed.columnMapping;
    detectedColumns = Object.keys(columnMapping);
    unmappedColumns = parsed.unmappedColumns;
    sourceRows = parsed.sourceRows;
    skippedRows = parsed.skippedRows;

    if (Object.keys(columnMapping).length === 0) {
      const hint =
        section === "grammar"
          ? "CHỮ HÁN, PINYIN, NGHĨA TIẾNG VIỆT, CẤU TRÚC, CÁCH DÙNG, ĐIỂM NGỮ PHÁP, MÃ"
          : section === "vocabulary"
            ? "Tiếng Trung, Pinyin, Nghĩa tiếng Việt…"
            : fieldNames.slice(0, 4).join(", ");
      warnings.push(
        `Không khớp được tiêu đề cột với trường: ${fieldNames.join(", ")}. ` +
          `Hàng 1 cần tên cột giống Browse (vd: ${hint}).`,
      );
    }

    if (cards.length === 0) {
      warnings.push("Không đọc được dòng nào từ Excel/CSV. Kiểm tra dòng tiêu đề cột.");
    } else if (skippedRows > 0) {
      warnings.push(
        `Đã bỏ qua ${skippedRows}/${sourceRows} dòng (trống, trùng header, hoặc thiếu CHỮ HÁN/NGHĨA TIẾNG VIỆT).`,
      );
    }
    if (unmappedColumns.length > 0) {
      warnings.push(`Cột chưa khớp trường: ${unmappedColumns.join(", ")}`);
    }
  } else {
    let text = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
    cards = parseNotepadText(text, section, fieldNames);
    if (cards.length === 0) {
      warnings.push("Không đọc được dòng nào từ Notepad. Dùng tab, | hoặc ; giữa các cột.");
    }
  }

  const bySection: Record<string, number> = {};
  for (const c of cards) {
    bySection[c.section] = (bySection[c.section] ?? 0) + 1;
  }

  return {
    cards,
    total: cards.length,
    bySection,
    detectedColumns,
    columnMapping,
    unmappedColumns,
    expectedFields: fieldNames,
    warnings,
    sample: cards.slice(0, 8),
    sourceRows: sourceRows || undefined,
    skippedRows: skippedRows || undefined,
  };
}

export function resolveAudioUrl(
  value: string | undefined,
  audioBaseUrl: string,
): string | undefined {
  if (!value) return undefined;
  let v = value.trim();

  const audioTag = v.match(/<audio[^>]+src=["']([^"']+)["']/i);
  if (audioTag?.[1]) v = audioTag[1].trim();

  const sound = v.match(/\[sound:([^\]]+)\]/i);
  if (sound?.[1]) v = sound[1].trim();

  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("//")) return `https:${v}`;

  // Link không có https:// nhưng rõ ràng là URL ngoài (Google Drive, CDN, TTS…)
  if (/^[a-z0-9.-]+\.[a-z]{2,}\/\S+/i.test(v) && !v.startsWith("/")) {
    return v.includes("://") ? v : `https://${v.replace(/^https?:\/\//i, "")}`;
  }

  if (v.startsWith("/")) return v;

  const name = v.replace(/^.*[\\/]/, "");
  return `${audioBaseUrl}/${encodeURIComponent(name)}`;
}

/** Lưu vào DB: giữ nguyên link ngoài, chỉ map tên file → /uploads/audio/… */
export function storeAudioReference(
  value: string | undefined,
  audioBaseUrl = "/uploads/audio",
): string | null {
  if (!value?.trim()) return null;
  const resolved = resolveAudioUrl(value, audioBaseUrl);
  return resolved ?? null;
}

export const IMPORT_COLUMN_HINTS = {
  section: ["phần", "loại", "section", "dạng bài"],
  front: ["Tiếng Trung", "Câu hỏi", "Chữ Hán", "Cụm từ", "Mảnh câu", "Cấu trúc", "Tình huống"],
  back: ["Nghĩa tiếng Việt", "Đáp án", "Nghĩa", "Giải thích", "Câu đúng", "Câu trả lời"],
  pinyin: ["Pinyin", "Phiên âm"],
  audio: ["Âm thanh", "mp3", "Tên file"],
  example: ["Đặt câu", "Ví dụ", "VD"],
  extra: ["Nghĩa hán việt", "Loại từ", "Hán Việt"],
};

import * as XLSX from "xlsx";
import {
  coreFieldForSection,
  getSectionPreset,
  IMPORT_FIELD_ALIASES,
  importFieldNamesForSection,
  requiredFieldLabels,
} from "@/lib/section-presets";
import { parseSectionValue, sectionFromSheetName, type StudySectionId } from "@/lib/sections";

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
  expectedFields: string[];
  warnings: string[];
  sample: ParsedCard[];
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

function resolveAliasTarget(aliasTarget: string, fieldNames: string[]): string | null {
  if (fieldNames.includes(aliasTarget)) return aliasTarget;
  const norm = normHeader(aliasTarget);
  return fieldNames.find((f) => normHeader(f) === norm) ?? null;
}

/** Gán tên cột Excel → đúng tên field trong preset / bộ thẻ */
export function headerToFieldName(header: string, fieldNames: string[]): string | null {
  const norm = normHeader(header);
  if (!norm || SKIP_HEADERS.has(norm)) return null;

  for (const name of fieldNames) {
    if (normHeader(name) === norm) return name;
  }

  const aliasTarget = IMPORT_FIELD_ALIASES[norm];
  if (aliasTarget) {
    const resolved = resolveAliasTarget(aliasTarget, fieldNames);
    if (resolved) return resolved;
  }

  let best: { field: string; score: number } | null = null;

  for (const [alias, target] of Object.entries(IMPORT_FIELD_ALIASES)) {
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
export function buildColumnMapping(headers: string[], fieldNames: string[]): ColumnMapping {
  const candidates: { colIdx: number; header: string; field: string; score: number }[] = [];

  headers.forEach((header, colIdx) => {
    const field = headerToFieldName(header, fieldNames);
    if (!field) return;
    const norm = normHeader(header);
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

function rowLooksLikeHeader(cells: string[], fieldNames: string[]): boolean {
  let hits = 0;
  for (const cell of cells) {
    if (cell.trim() && headerToFieldName(cell, fieldNames)) hits++;
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
  const fieldNameSet = new Set(Object.keys(fields));
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

  if (!front || !back) return null;
  if (/^\d+$/.test(front) && front.length <= 4 && !fieldNameSet.has(frontLabel)) return null;

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
): ParsedCard | null {
  const preset = getSectionPreset(section);
  const names = fieldNames.length ? fieldNames : preset.fieldDefs.map((f) => f.name);
  const values: Record<string, string> = {};
  const limit = Math.min(rowArr.length, names.length);
  for (let col = 0; col < limit; col++) {
    const val = String(rowArr[col] ?? "").trim();
    if (!val || SKIP_HEADERS.has(normHeader(val))) continue;
    values[names[col]!] = val;
  }
  if (Object.keys(values).length < 2) return null;
  return applyPresetFields(section, values);
}

function rowToCard(
  rowArr: string[],
  section: StudySectionId,
  columnMap: ColumnMapping,
  fieldNames: string[],
): ParsedCard | null {
  const mapped = fieldsFromMappedRow(rowArr, columnMap);
  if (Object.keys(mapped).length >= 2) {
    const card = applyPresetFields(section, mapped);
    if (card) return card;
  }
  return positionalRowByPreset(rowArr, section, fieldNames);
}

function findHeaderRow(
  rawRows: string[][],
  fieldNames: string[],
): number {
  for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;
    const cells = row.map((c) => String(c ?? "").trim());
    const nonEmpty = cells.filter(Boolean);
    if (nonEmpty.length < 2) continue;
    if (rowLooksLikeHeader(cells, fieldNames)) return r;
  }
  return 0;
}

export function parseExcelBuffer(
  buffer: ArrayBuffer,
  options: ImportParseOptions = {},
): { cards: ParsedCard[]; columnMapping: Record<string, string>; expectedFields: string[] } {
  const deckSection = options.deckSection ?? "vocabulary";
  const fieldNames =
    options.fieldNames?.length
      ? options.fieldNames
      : importFieldNamesForSection(deckSection);

  const wb = XLSX.read(buffer, { type: "array" });
  const cards: ParsedCard[] = [];
  let columnMapping: Record<string, string> = {};

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

    const headerIdx = findHeaderRow(rawRows as string[][], sheetFieldNames);
    const headers = ((rawRows[headerIdx] as string[]) || []).map((h) => String(h ?? "").trim());
    const columnMap = buildColumnMapping(headers, sheetFieldNames);

    if (columnMap.size > 0 && Object.keys(columnMapping).length === 0) {
      columnMapping = mappingToRecord(headers, columnMap);
    }

    for (let i = headerIdx + 1; i < rawRows.length; i++) {
      const rowArr = rawRows[i] as string[];
      if (!Array.isArray(rowArr)) continue;

      const hasData = rowArr.some((c) => String(c ?? "").trim());
      if (!hasData) continue;

      if (rowLooksLikeHeader(rowArr.map((c) => String(c ?? "").trim()), sheetFieldNames)) {
        continue;
      }

      const card = rowToCard(rowArr, sheetSection, columnMap, sheetFieldNames);
      if (card) cards.push({ ...card, section: options.deckSection ?? card.section });
    }
  }

  return { cards, columnMapping, expectedFields: fieldNames };
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

function isHeaderLine(parts: string[], fieldNames: string[]): boolean {
  if (parts.length < 2) return false;
  let hits = 0;
  for (const p of parts) {
    if (p.trim() && headerToFieldName(p, fieldNames)) hits++;
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
    if (isHeaderLine(parts, names)) continue;

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

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    const parsed = parseExcelBuffer(buffer, { ...opts, deckSection: section, fieldNames });
    cards = parsed.cards;
    columnMapping = parsed.columnMapping;
    detectedColumns = Object.keys(columnMapping);

    if (Object.keys(columnMapping).length === 0) {
      warnings.push(
        `Không khớp được tiêu đề cột với trường: ${fieldNames.join(", ")}. ` +
          "Đảm bảo hàng 1 có tên cột giống Browse (vd: Tiếng Trung, Pinyin, Nghĩa hán việt…).",
      );
    }

    if (cards.length === 0) {
      warnings.push("Không đọc được dòng nào từ Excel/CSV. Kiểm tra dòng tiêu đề cột.");
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
    expectedFields: fieldNames,
    warnings,
    sample: cards.slice(0, 8),
  };
}

export function resolveAudioUrl(
  value: string | undefined,
  audioBaseUrl: string,
): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  const name = value.replace(/^.*[\\/]/, "");
  return `${audioBaseUrl}/${encodeURIComponent(name)}`;
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

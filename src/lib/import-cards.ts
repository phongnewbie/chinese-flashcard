import * as XLSX from "xlsx";
import {
  coreFieldForSection,
  IMPORT_FIELD_ALIASES,
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
  warnings: string[];
  sample: ParsedCard[];
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

const COLUMN_HINTS = {
  section: [
    "section", "phan", "phần", "loai", "loại", "type", "module", "muc", "mục",
    "bo phan", "bộ phận", "dang bai", "dạng bài", "dang", "dạng",
  ],
  front: [
    "front", "chu han", "chữ hán", "han tu", "hanzi", "汉字", "tu", "từ",
    "tieng trung", "tiếng trung",
    "tu trung", "từ trung", "cum tu", "cụm từ", "cau hoi", "câu hỏi",
    "cau", "câu", "cau trung", "cau tieng trung", "noi dung", "nội dung",
    "cau truc", "cấu trúc", "mau cau", "mẫu câu", "de bai", "đề bài",
    "mang cau", "mảnh câu", "cac manh", "các mảnh", "manh", "mảnh",
    "parts", "sap xep", "sắp xếp", "tu roi", "từ rời", "scramble",
    "question", "cau sai", "cau hoi sap xep", "noi dung cau hoi",
    "cau hoi tieng trung", "tieng trung", "chinese", "han ngu",
  ],
  back: [
    "back", "nghia", "nghĩa", "nghia tieng viet", "nghĩa tiếng việt",
    "nghia cua cau", "nghĩa của câu",
    "meaning", "dich", "dịch", "tieng viet", "tiếng việt", "viet", "vi",
    "giai thich", "giải thích", "huong dan", "hướng dẫn", "dap an", "đáp án",
    "cau dung", "câu đúng", "tra loi", "trả lời", "answer", "correct",
    "ket qua", "kết quả", "ghi chu", "ghi chú", "note", "mo ta", "mô tả",
    "tinh huong", "tình huống", "loi giai", "lời giải", "y nghia",
  ],
  pinyin: [
    "pinyin", "phien am", "phiên âm", "phien am cau", "phiên âm câu",
    "am han", "âm hán", "thanh mau", "thanh điệu", "bo thanh mau", "bổ thanh mau", "phat am",
  ],
  audio: [
    "audio", "audiourl", "audio url", "am thanh", "âm thanh", "file am thanh",
    "file audio", "mp3", "link am thanh", "link audio", "ten file", "tên file",
    "file mp3", "am thanh mp3",
  ],
  example: ["vi du", "ví dụ", "example", "cau vi du", "câu ví dụ", "vd", "dat cau", "đặt câu"],
} as const;

function canonicalFieldName(header: string): string {
  const norm = normHeader(header);
  return IMPORT_FIELD_ALIASES[norm] ?? header.trim();
}

function applyCanonicalRow(
  section: StudySectionId,
  fields: Record<string, string>,
): ParsedCard | null {
  let front = "";
  let back = "";
  let pinyin = "";
  let audioUrl = "";
  const extraFields: Record<string, string> = {};

  for (const [header, value] of Object.entries(fields)) {
    if (!value?.trim()) continue;
    const canonical = canonicalFieldName(header);
    const core = coreFieldForSection(section, canonical);
    if (core === "front") front = value.trim();
    else if (core === "back") back = value.trim();
    else if (core === "pinyin") pinyin = value.trim();
    else if (core === "audioUrl") audioUrl = value.trim();
    else extraFields[canonical] = value.trim();
  }

  if (!front || !back) return null;
  if (/^\d+$/.test(front) && front.length <= 4) return null;

  return {
    section,
    front,
    back,
    pinyin: pinyin || undefined,
    audioUrl: audioUrl || undefined,
    extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
  };
}

type Field = keyof typeof COLUMN_HINTS;

function scoreHeader(norm: string, hints: readonly string[]): number {
  if (SKIP_HEADERS.has(norm)) return -100;
  let best = 0;
  for (const hint of hints) {
    const h = normHeader(hint);
    if (norm === h) best = Math.max(best, 100);
    else if (norm.includes(h) || h.includes(norm)) best = Math.max(best, 70);
    else {
      const words = h.split(" ").filter((w) => w.length > 2);
      const hits = words.filter((w) => norm.includes(w)).length;
      if (hits > 0) best = Math.max(best, 40 + hits * 15);
    }
  }
  return best;
}

type RowMap = { key: string; norm: string; value: string }[];

function buildRowMap(row: Record<string, string>, keys: string[]): RowMap {
  return keys
    .filter((k) => row[k] !== undefined && !/^__EMPTY/.test(k))
    .map((k) => ({
      key: k,
      norm: normHeader(k),
      value: String(row[k] ?? "").trim(),
    }));
}

function pickBestField(map: RowMap, field: Field, used: Set<string>): string | undefined {
  let bestKey: string | undefined;
  let bestScore = 0;
  for (const col of map) {
    if (used.has(col.key) || !col.value) continue;
    const score = scoreHeader(col.norm, COLUMN_HINTS[field]);
    if (score > bestScore) {
      bestScore = score;
      bestKey = col.key;
    }
  }
  if (bestScore < 35) return undefined;
  used.add(bestKey!);
  return map.find((c) => c.key === bestKey)?.value;
}

function pickSection(map: RowMap, defaultSection: StudySectionId, used: Set<string>): StudySectionId {
  const raw = pickBestField(map, "section", used);
  return raw ? parseSectionValue(raw) : defaultSection;
}

function positionalPick(
  map: RowMap,
  section: StudySectionId,
): { front?: string; back?: string; pinyin?: string; audio?: string } {
  const cols = map.filter(
    (c) => !SKIP_HEADERS.has(c.norm) && c.value !== "" && scoreHeader(c.norm, COLUMN_HINTS.section) < 35,
  );
  if (cols.length < 2) return {};

  if (section === "grammar" && cols.length >= 2) {
    const front = cols[0]?.value;
    const backMain = cols[1]?.value;
    const example = cols[2]?.value;
    const back = example && !scoreHeader(cols[2].norm, COLUMN_HINTS.example)
      ? backMain
      : example
        ? `${backMain}\n${example}`
        : backMain;
    return {
      front,
      back,
      pinyin: cols[3]?.value,
      audio: cols[4]?.value,
    };
  }

  return {
    front: cols[0]?.value,
    back: cols[1]?.value,
    pinyin: cols[2]?.value,
    audio: cols[3]?.value,
  };
}

function rowToCard(
  row: Record<string, string>,
  keys: string[],
  defaultSection: StudySectionId,
): ParsedCard | null {
  const map = buildRowMap(row, keys);
  if (map.length === 0) return null;

  const used = new Set<string>();
  const section = pickSection(map, defaultSection, used);

  const rawFields: Record<string, string> = {};
  for (const col of map) {
    if (SKIP_HEADERS.has(col.norm) || !col.value) continue;
    rawFields[col.key.trim()] = col.value;
  }

  const canonical = applyCanonicalRow(section, rawFields);
  if (canonical) return canonical;

  let front = pickBestField(map, "front", used);
  let back = pickBestField(map, "back", used);
  let pinyin = pickBestField(map, "pinyin", used);
  let audioUrl = pickBestField(map, "audio", used);

  if (!front || !back) {
    const pos = positionalPick(map, section);
    front = front ?? pos.front;
    back = back ?? pos.back;
    pinyin = pinyin ?? pos.pinyin;
    audioUrl = audioUrl ?? pos.audio;
    if (pos.front) used.add(map.find((c) => c.value === pos.front)?.key ?? "");
    if (pos.back) used.add(map.find((c) => c.value === pos.back)?.key ?? "");
  }

  const extraFields: Record<string, string> = {};
  for (const col of map) {
    if (used.has(col.key) || !col.value || SKIP_HEADERS.has(col.norm)) continue;
    extraFields[canonicalFieldName(col.key)] = col.value;
  }

  if (!front || !back) return null;
  if (/^\d+$/.test(front) && front.length <= 4) return null;

  return {
    section,
    front,
    back,
    pinyin,
    audioUrl,
    extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
  };
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

function isHeaderLine(parts: string[]): boolean {
  if (parts.length < 2) return false;
  const scores = parts.map((p) => normHeader(p));
  const frontScore = Math.max(...scores.map((s) => scoreHeader(s, COLUMN_HINTS.front)));
  const backScore = Math.max(...scores.map((s) => scoreHeader(s, COLUMN_HINTS.back)));
  return frontScore >= 70 || backScore >= 70;
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
export function parseNotepadText(text: string): ParsedCard[] {
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
    if (isHeaderLine(parts)) continue;

    let section = currentSection;
    let offset = 0;
    if (parts.length >= 3 && isSectionToken(parts[0])) {
      section = parseSectionValue(parts[0]);
      offset = 1;
    }

    const rest = parts.slice(offset);
    if (rest.length < 2) continue;

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

export function parseExcelBuffer(buffer: ArrayBuffer, deckSection?: StudySectionId): ParsedCard[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const cards: ParsedCard[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const sheetSection = sectionFromSheetName(sheetName) ?? deckSection ?? "vocabulary";
    const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
    if (rawRows.length === 0) continue;

    let headerIdx = 0;
    for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;
      const nonEmpties = row.map((c) => String(c ?? "").trim()).filter(Boolean);
      if (nonEmpties.length < 2) continue;

      const isHeader = nonEmpties.some((cell) => {
        const norm = normHeader(cell);
        return (
          scoreHeader(norm, COLUMN_HINTS.front) >= 35 ||
          scoreHeader(norm, COLUMN_HINTS.back) >= 35 ||
          scoreHeader(norm, COLUMN_HINTS.pinyin) >= 35 ||
          scoreHeader(norm, COLUMN_HINTS.example) >= 35 ||
          scoreHeader(norm, COLUMN_HINTS.section) >= 35
        );
      });

      if (isHeader) {
        headerIdx = r;
        break;
      }
    }

    const headers = (rawRows[headerIdx] || []).map((h) => String(h ?? "").trim());

    for (let i = headerIdx + 1; i < rawRows.length; i++) {
      const rowArr = rawRows[i];
      if (!Array.isArray(rowArr)) continue;

      const rowObj: Record<string, string> = {};
      let hasData = false;
      headers.forEach((h, colIdx) => {
        const val = String(rowArr[colIdx] ?? "").trim();
        if (val) hasData = true;
        const key = h || `__COL_${colIdx}`;
        rowObj[key] = val;
      });

      if (!hasData) continue;
      const card = rowToCard(rowObj, Object.keys(rowObj), sheetSection ?? "vocabulary");
      if (card) cards.push(card);
    }
  }

  return cards;
}

export function parseImportFile(
  buffer: ArrayBuffer,
  fileName: string,
  deckSection?: StudySectionId,
): ImportPreview {
  const lower = fileName.toLowerCase();
  const warnings: string[] = [];
  let cards: ParsedCard[];

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    cards = parseExcelBuffer(buffer, deckSection);
    if (cards.length === 0) {
      warnings.push("Không đọc được dòng nào từ Excel/CSV. Kiểm tra dòng tiêu đề cột.");
    }
  } else {
    let text = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
    cards = parseNotepadText(text);
    if (cards.length === 0) {
      warnings.push("Không đọc được dòng nào từ Notepad. Dùng tab, | hoặc ; giữa các cột.");
    }
  }

  const bySection: Record<string, number> = {};
  for (const c of cards) {
    bySection[c.section] = (bySection[c.section] ?? 0) + 1;
  }

  const detectedColumns: string[] = [];
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (sheet) {
      const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
      let headerIdx = 0;
      for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
        const row = rawRows[r];
        if (!Array.isArray(row)) continue;
        const nonEmpties = row.map((c) => String(c ?? "").trim()).filter(Boolean);
        if (nonEmpties.length < 2) continue;

        const isHeader = nonEmpties.some((cell) => {
          const norm = normHeader(cell);
          return (
            scoreHeader(norm, COLUMN_HINTS.front) >= 35 ||
            scoreHeader(norm, COLUMN_HINTS.back) >= 35 ||
            scoreHeader(norm, COLUMN_HINTS.pinyin) >= 35 ||
            scoreHeader(norm, COLUMN_HINTS.example) >= 35 ||
            scoreHeader(norm, COLUMN_HINTS.section) >= 35
          );
        });

        if (isHeader) {
          headerIdx = r;
          break;
        }
      }
      const headerRow = rawRows[headerIdx];
      if (Array.isArray(headerRow)) {
        detectedColumns.push(...headerRow.map((c) => String(c ?? "").trim()).filter(Boolean));
      }
    }
  }

  return {
    cards,
    total: cards.length,
    bySection,
    detectedColumns,
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

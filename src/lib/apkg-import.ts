import JSZip from "jszip";
import Database from "better-sqlite3";
import { decompress } from "fzstd";
import { mkdir, writeFile } from "fs/promises";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { firstAudioInText } from "@/lib/anki-sound";
import { storeAudioReference } from "@/lib/import-cards";
import { getAudioUploadDir } from "@/lib/paths";

export type ApkgNote = {
  front: string;
  back: string;
  pinyin: string;
  tags: string;
  audioUrl: string | null;
  extras: Record<string, string>;
};

export type ApkgImportResult = {
  notes: ApkgNote[];
  mediaImported: number;
};

const FIELD_SEP = "\u001f";

const FRONT_KEYS = ["front", "tiếng trung", "tieng trung", "chinese", "hanzi", "question", "word"];
const BACK_KEYS = ["back", "nghĩa tiếng việt", "nghia tieng viet", "meaning", "answer", "vietnamese", "definition"];
const PINYIN_KEYS = ["pinyin", "phiên âm", "phien am"];

function safeMediaName(filename: string): string {
  const base = path.basename(filename.trim());
  return base.replace(/[^\w.\-()+\u4e00-\u9fff]/g, "_") || "media.bin";
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\u001f/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickNamedField(fields: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const match = Object.entries(fields).find(([name]) => name.toLowerCase() === key);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  for (const key of keys) {
    const match = Object.entries(fields).find(([name]) => name.toLowerCase().includes(key));
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return "";
}

function storeApkgAudio(raw: string | null, fileMap: Record<string, string>): string | null {
  if (!raw?.trim()) return null;
  const sound = raw.match(/\[sound:([^\]]+)\]/i);
  if (sound?.[1]) {
    const orig = sound[1].trim();
    const safe =
      fileMap[orig.toLowerCase()] ??
      fileMap[path.basename(orig).toLowerCase()] ??
      safeMediaName(orig);
    return storeAudioReference(`[sound:${safe}]`);
  }
  return storeAudioReference(raw);
}

/** Giải nén file media từ .apkg vào thư mục audio upload. */
export async function extractApkgMedia(
  buffer: Buffer,
): Promise<{ count: number; fileMap: Record<string, string> }> {
  const audioDestDir = getAudioUploadDir();
  const zip = await JSZip.loadAsync(buffer);
  const mediaEntry = zip.file("media");
  const fileMap: Record<string, string> = {};
  if (!mediaEntry) return { count: 0, fileMap };

  const raw = await mediaEntry.async("nodebuffer");
  let mapping: Record<string, string> = {};
  try {
    mapping = JSON.parse(raw.toString("utf8")) as Record<string, string>;
  } catch {
    return { count: 0, fileMap };
  }

  await mkdir(/* turbopackIgnore: true */ audioDestDir, { recursive: true });
  let count = 0;

  for (const [idx, originalName] of Object.entries(mapping)) {
    if (!originalName?.trim()) continue;
    const entry = zip.file(idx);
    if (!entry) continue;
    const fileName = safeMediaName(originalName);
    fileMap[originalName.toLowerCase()] = fileName;
    fileMap[path.basename(originalName).toLowerCase()] = fileName;
    const destPath = path.join(/* turbopackIgnore: true */ audioDestDir, fileName);
    const data = await entry.async("nodebuffer");
    await writeFile(/* turbopackIgnore: true */ destPath, data);
    count += 1;
  }

  return { count, fileMap };
}

async function readCollectionBuffer(zip: JSZip): Promise<Buffer> {
  const names = Object.keys(zip.files).filter((n) => /^collection\.anki/i.test(n));
  const order = ["collection.anki21b", "collection.anki21", "collection.anki2"];

  for (const pref of order) {
    const key = names.find((n) => n.toLowerCase() === pref);
    if (!key) continue;
    const entry = zip.file(key);
    if (!entry) continue;
    const raw = Buffer.from(await entry.async("nodebuffer"));

    if (pref.endsWith("21b")) {
      try {
        return Buffer.from(decompress(raw));
      } catch {
        throw new Error(
          "Không giải nén được collection.anki21b. Hãy mở deck trong Anki rồi export lại file .apkg.",
        );
      }
    }
    return raw;
  }

  throw new Error("Không tìm thấy collection.anki2 / anki21 / anki21b trong file apkg");
}

function isStubCollection(notes: ApkgNote[]): boolean {
  if (notes.length !== 1) return false;
  const text = `${notes[0]?.front} ${notes[0]?.back}`.toLowerCase();
  return text.includes("update anki") || text.includes("please update") || text.includes("unsupported");
}

function mapNoteRow(
  row: { flds: string; tags: string; mid: number },
  fieldNamesByMid: Map<number, string[]>,
  fileMap: Record<string, string>,
): ApkgNote {
  const names = fieldNamesByMid.get(row.mid) ?? [];
  const parts = row.flds.split(FIELD_SEP);
  const named: Record<string, string> = {};
  names.forEach((name, i) => {
    named[name] = stripHtml(parts[i] ?? "");
  });

  const strippedParts = parts.map(stripHtml).filter(Boolean);
  let front = pickNamedField(named, FRONT_KEYS);
  let back = pickNamedField(named, BACK_KEYS);
  const pinyin = pickNamedField(named, PINYIN_KEYS);

  if (!front && strippedParts[0]) front = strippedParts[0];
  if (!back && strippedParts[1]) back = strippedParts[1];
  if (!front || !back) {
    const remaining = strippedParts.filter((p) => p !== front && p !== back);
    if (!front && remaining[0]) front = remaining[0];
    if (!back && remaining[1]) back = remaining[1];
    if (!back && remaining[0] && remaining[0] !== front) back = remaining[0];
  }

  const extras: Record<string, string> = {};
  for (const [name, val] of Object.entries(named)) {
    if (!val.trim()) continue;
    const lower = name.toLowerCase();
    if (FRONT_KEYS.some((k) => lower.includes(k)) && val === front) continue;
    if (BACK_KEYS.some((k) => lower.includes(k)) && val === back) continue;
    if (PINYIN_KEYS.some((k) => lower.includes(k)) && val === pinyin) continue;
    extras[name] = val;
  }

  return {
    front,
    back,
    pinyin,
    tags: (row.tags ?? "").replace(/\s+/g, " ").trim(),
    audioUrl: storeApkgAudio(
      firstAudioInText(row.flds) ??
        pickAudioFromFields(named) ??
        pickAudioFromFields(extras),
      fileMap,
    ),
    extras,
  };
}

function pickAudioFromFields(fields: Record<string, string>): string | null {
  for (const val of Object.values(fields)) {
    const audio = firstAudioInText(val);
    if (audio) return audio;
  }
  return null;
}

export async function parseApkgBuffer(buffer: Buffer): Promise<ApkgNote[]> {
  const result = await parseApkgWithMedia(buffer);
  return result.notes;
}

export async function parseApkgWithMedia(buffer: Buffer, extractMedia = true): Promise<ApkgImportResult> {
  let mediaImported = 0;
  let fileMap: Record<string, string> = {};
  if (extractMedia) {
    const extracted = await extractApkgMedia(buffer);
    mediaImported = extracted.count;
    fileMap = extracted.fileMap;
  }

  const zip = await JSZip.loadAsync(buffer);
  let dbBuf = await readCollectionBuffer(zip);

  const dir = mkdtempSync(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ tmpdir(), "apkg-"));
  const dbPath = path.join(/* turbopackIgnore: true */ dir, "col.anki2");

  try {
    writeFileSync(/* turbopackIgnore: true */ dbPath, dbBuf);
    let notes = readNotesFromDb(dbPath, fileMap);

    if (isStubCollection(notes)) {
      const altKey = Object.keys(zip.files).find((n) => n.toLowerCase() === "collection.anki21b");
      if (altKey && zip.file(altKey)) {
        const raw = Buffer.from(await zip.file(altKey)!.async("nodebuffer"));
        dbBuf = Buffer.from(decompress(raw));
        writeFileSync(/* turbopackIgnore: true */ dbPath, dbBuf);
        notes = readNotesFromDb(dbPath, fileMap);
      }
    }

    return { notes, mediaImported };
  } finally {
    rmSync(/* turbopackIgnore: true */ dir, { recursive: true, force: true });
  }
}

function readNotesFromDb(dbPath: string, fileMap: Record<string, string>): ApkgNote[] {
  const db = new Database(dbPath, { readonly: true });

  const fieldNamesByMid = new Map<number, string[]>();
  try {
    const typeRows = db.prepare("SELECT id, flds FROM notetypes").all() as { id: number; flds: string }[];
    for (const nt of typeRows) {
      try {
        const parsed = JSON.parse(nt.flds) as { name?: string }[];
        fieldNamesByMid.set(
          nt.id,
          parsed.map((f) => f.name?.trim() ?? "").filter(Boolean),
        );
      } catch {
        fieldNamesByMid.set(nt.id, []);
      }
    }
  } catch {
    /* older schemas */
  }

  const rows = db
    .prepare("SELECT flds, tags, mid FROM notes WHERE flds IS NOT NULL AND flds != ''")
    .all() as { flds: string; tags: string; mid: number }[];
  db.close();

  return rows.map((row) => mapNoteRow(row, fieldNamesByMid, fileMap));
}

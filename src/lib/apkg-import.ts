import JSZip from "jszip";
import Database from "better-sqlite3";
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

function safeMediaName(filename: string): string {
  const base = path.basename(filename.trim());
  return base.replace(/[^\w.\-()+\u4e00-\u9fff]/g, "_") || "media.bin";
}

/** Giải nén file media từ .apkg vào thư mục audio upload. */
export async function extractApkgMedia(buffer: Buffer): Promise<number> {
  const audioDestDir = getAudioUploadDir();
  const zip = await JSZip.loadAsync(buffer);
  const mediaEntry = zip.file("media");
  if (!mediaEntry) return 0;

  const raw = await mediaEntry.async("nodebuffer");
  let mapping: Record<string, string> = {};
  try {
    mapping = JSON.parse(raw.toString("utf8")) as Record<string, string>;
  } catch {
    return 0;
  }

  await mkdir(audioDestDir, { recursive: true });
  let count = 0;

  for (const [idx, originalName] of Object.entries(mapping)) {
    if (!originalName?.trim()) continue;
    const entry = zip.file(idx);
    if (!entry) continue;
    const fileName = safeMediaName(originalName);
    const destPath = path.join(/* turbopackIgnore: true */ audioDestDir, fileName);
    const data = await entry.async("nodebuffer");
    await writeFile(destPath, data);
    count += 1;
  }

  return count;
}

function pickAudioUrl(front: string, back: string, pinyin: string, extras: Record<string, string>): string | null {
  for (const raw of [
    firstAudioInText(front),
    firstAudioInText(back),
    firstAudioInText(pinyin),
    ...Object.values(extras).map((v) => firstAudioInText(v)),
  ]) {
    if (raw) return storeAudioReference(raw);
  }
  return null;
}

export async function parseApkgBuffer(buffer: Buffer): Promise<ApkgNote[]> {
  const result = await parseApkgWithMedia(buffer);
  return result.notes;
}

export async function parseApkgWithMedia(buffer: Buffer, extractMedia = true): Promise<ApkgImportResult> {
  let mediaImported = 0;
  if (extractMedia) {
    mediaImported = await extractApkgMedia(buffer);
  }

  const zip = await JSZip.loadAsync(buffer);
  const collName = Object.keys(zip.files).find((n) => /^collection\.anki2/i.test(n));
  const collEntry = collName ? zip.file(collName) : null;
  if (!collEntry) throw new Error("Không tìm thấy collection.anki2 trong file apkg");

  const dbBuf = await collEntry.async("nodebuffer");
  const dir = mkdtempSync(path.join(/* turbopackIgnore: true */ tmpdir(), "apkg-"));
  const dbPath = path.join(/* turbopackIgnore: true */ dir, "col.anki2");
  writeFileSync(dbPath, dbBuf);

  try {
    const db = new Database(dbPath, { readonly: true });
    const rows = db
      .prepare("SELECT flds, tags FROM notes WHERE flds IS NOT NULL AND flds != ''")
      .all() as { flds: string; tags: string }[];
    db.close();

    const notes = rows.map((row) => {
      const parts = row.flds.split(FIELD_SEP);
      const front = parts[0]?.trim() ?? "";
      const back = parts[1]?.trim() ?? "";
      const pinyin = parts[2]?.trim() ?? "";
      const extras: Record<string, string> = {};
      parts.slice(3).forEach((val, i) => {
        if (val.trim()) extras[`Field${i + 4}`] = val.trim();
      });
      return {
        front,
        back,
        pinyin,
        tags: (row.tags ?? "").replace(/\s+/g, " ").trim(),
        audioUrl: pickAudioUrl(front, back, pinyin, extras),
        extras,
      };
    });

    return { notes, mediaImported };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

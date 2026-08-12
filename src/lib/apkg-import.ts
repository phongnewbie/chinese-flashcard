import JSZip from "jszip";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export type ApkgNote = {
  front: string;
  back: string;
  pinyin: string;
  tags: string;
  extras: Record<string, string>;
};

const FIELD_SEP = "\u001f";

export async function parseApkgBuffer(buffer: Buffer): Promise<ApkgNote[]> {
  const zip = await JSZip.loadAsync(buffer);
  const collName = Object.keys(zip.files).find((n) => /^collection\.anki2/i.test(n));
  const collEntry = collName ? zip.file(collName) : null;
  if (!collEntry) throw new Error("Không tìm thấy collection.anki2 trong file apkg");

  const dbBuf = await collEntry.async("nodebuffer");
  const dir = mkdtempSync(join(tmpdir(), "apkg-"));
  const dbPath = join(dir, "col.anki2");
  writeFileSync(dbPath, dbBuf);

  try {
    const db = new Database(dbPath, { readonly: true });
    const rows = db
      .prepare("SELECT flds, tags FROM notes WHERE flds IS NOT NULL AND flds != ''")
      .all() as { flds: string; tags: string }[];
    db.close();

    return rows.map((row) => {
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
        extras,
      };
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

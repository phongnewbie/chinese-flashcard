import path from "path";
import { mkdir } from "fs/promises";

/** Thư mục dữ liệu persistent (Render disk: /var/data) — chủ yếu cho upload */
export function getDataDir(): string {
  return process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data");
}

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || "file:./dev.db";
}

export function isPostgresDatabase(url = getDatabaseUrl()): boolean {
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

/** SQLite file path từ DATABASE_URL hoặc mặc định */
export function getSqliteFilePath(): string {
  const url = getDatabaseUrl();
  if (url.startsWith("file:")) {
    const relative = url.replace(/^file:/, "").replace(/^\.\//, "");
    if (path.isAbsolute(relative)) return relative;
    return path.join(/* turbopackIgnore: true */ process.cwd(), relative);
  }
  return path.join(getDataDir(), "app.db");
}

/** Gốc thư mục upload (ảnh + audio) */
export function getUploadRoot(): string {
  return process.env.UPLOAD_DIR?.trim() || path.join(process.cwd(), "public", "uploads");
}

export function getImageUploadDir(): string {
  return path.join(getUploadRoot(), "images");
}

export function getAudioUploadDir(): string {
  return path.join(getUploadRoot(), "audio");
}

/** Tạo thư mục data + uploads khi khởi động (Render) */
export async function ensureDataDirs(): Promise<void> {
  const dataDir = getDataDir();
  await mkdir(dataDir, { recursive: true });
  await mkdir(getImageUploadDir(), { recursive: true });
  await mkdir(getAudioUploadDir(), { recursive: true });
}

export function uploadUrl(subpath: string): string {
  return `/uploads/${subpath.replace(/^\/+/, "")}`;
}

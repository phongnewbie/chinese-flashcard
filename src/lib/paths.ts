import path from "path";
import { accessSync, constants, mkdirSync } from "fs";
import { mkdir } from "fs/promises";

let resolvedDataDir: string | null = null;
let resolvedUploadRoot: string | null = null;

function canWriteDir(dir: string): boolean {
  try {
    mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
    accessSync(/* turbopackIgnore: true */ dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function defaultDataDir(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data");
}

/** Thư mục upload — fallback khi /var/data không gắn disk trên Render. */
export function getDataDir(): string {
  if (resolvedDataDir) return resolvedDataDir;

  const configured = process.env.DATA_DIR?.trim();
  if (configured && canWriteDir(configured)) {
    resolvedDataDir = configured;
    return configured;
  }

  if (configured) {
    console.warn(`[paths] DATA_DIR=${configured} không ghi được — dùng ${defaultDataDir()}`);
  }

  const fallback = defaultDataDir();
  mkdirSync(/* turbopackIgnore: true */ fallback, { recursive: true });
  resolvedDataDir = fallback;
  return fallback;
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
  return path.join(/* turbopackIgnore: true */ getDataDir(), "app.db");
}

/** Gốc thư mục upload (ảnh + audio) */
export function getUploadRoot(): string {
  if (resolvedUploadRoot) return resolvedUploadRoot;

  const configured = process.env.UPLOAD_DIR?.trim();
  if (configured && canWriteDir(configured)) {
    resolvedUploadRoot = configured;
    return configured;
  }

  if (configured) {
    console.warn(`[paths] UPLOAD_DIR=${configured} không ghi được — dùng data/uploads`);
  }

  const fallback = path.join(/* turbopackIgnore: true */ getDataDir(), "uploads");
  mkdirSync(/* turbopackIgnore: true */ fallback, { recursive: true });
  resolvedUploadRoot = fallback;
  return fallback;
}

export function getImageUploadDir(): string {
  return path.join(/* turbopackIgnore: true */ getUploadRoot(), "images");
}

export function getAudioUploadDir(): string {
  return path.join(/* turbopackIgnore: true */ getUploadRoot(), "audio");
}

/** Tạo thư mục data + uploads khi khởi động */
export async function ensureDataDirs(): Promise<void> {
  const dataDir = getDataDir();
  await mkdir(/* turbopackIgnore: true */ dataDir, { recursive: true });
  await mkdir(/* turbopackIgnore: true */ getImageUploadDir(), { recursive: true });
  await mkdir(/* turbopackIgnore: true */ getAudioUploadDir(), { recursive: true });
}

export function uploadUrl(subpath: string): string {
  return `/uploads/${subpath.replace(/^\/+/, "")}`;
}

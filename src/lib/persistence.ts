import { accessSync, constants } from "fs";
import {
  getDataDir,
  getDatabaseUrl,
  getUploadRoot,
  isPostgresDatabase,
} from "@/lib/paths";

export type PersistenceInfo = {
  dbProvider: "postgresql";
  dbPath: string;
  dataDir: string;
  uploadDir: string;
  dbExists: boolean;
  dbSizeBytes: number;
  dataDirWritable: boolean;
  onRenderDisk: boolean;
  persistent: boolean;
  warning?: string;
};

function dirWritable(dir: string): boolean {
  try {
    accessSync(/* turbopackIgnore: true */ dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function getPersistenceInfo(): PersistenceInfo {
  const dbUrl = getDatabaseUrl();
  const dbPath = dbUrl.replace(/\/\/[^@]+@/, "//***@");
  const dataDir = getDataDir();
  const uploadDir = getUploadRoot();

  const dataDirWritable = dirWritable(dataDir);
  const onRenderDisk =
    dataDir.replace(/\\/g, "/").startsWith("/var/data") ||
    uploadDir.replace(/\\/g, "/").startsWith("/var/data");

  const isLocalDev = process.env.NODE_ENV !== "production";
  const persistent = isPostgresDatabase(dbUrl) || isLocalDev;

  let warning: string | undefined;
  if (!isPostgresDatabase(dbUrl) && process.env.NODE_ENV === "production") {
    warning = "Chưa cấu hình DATABASE_URL PostgreSQL (Neon) trên Render.";
  }

  return {
    dbProvider: "postgresql",
    dbPath,
    dataDir,
    uploadDir,
    dbExists: isPostgresDatabase(dbUrl),
    dbSizeBytes: 0,
    dataDirWritable,
    onRenderDisk,
    persistent,
    warning,
  };
}

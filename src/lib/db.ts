import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { ensureDataDirs, getSqliteFilePath } from "@/lib/paths";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrisma() {
  const dbPath = getSqliteFilePath();
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function ensureAppSettings() {
  await ensureDataDirs();
  await prisma.appSetting.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}

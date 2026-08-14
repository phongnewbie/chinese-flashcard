import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { ensureDataDirs, getSqliteFilePath } from "@/lib/paths";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma() {
  const dbPath = getSqliteFilePath();
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

/** Dev HMR giữ Prisma cũ sau migrate/generate — tạo lại nếu thiếu delegate mới. */
function getPrisma(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && "userHskLevel" in cached) {
    return cached;
  }
  const client = createPrisma();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getPrisma();

export async function ensureAppSettings() {
  await ensureDataDirs();
  await prisma.appSetting.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}

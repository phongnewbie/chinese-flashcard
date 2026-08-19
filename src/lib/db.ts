import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDataDirs, getDatabaseUrl, isPostgresDatabase } from "@/lib/paths";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; dbReady?: boolean };

function createPrisma(): PrismaClient {
  const url = getDatabaseUrl();
  if (!isPostgresDatabase(url)) {
    throw new Error(
      "DATABASE_URL phải trỏ tới PostgreSQL (Neon). " +
        "Ví dụ: postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require",
    );
  }
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

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

/** Lazy proxy — tránh kết nối DB lúc `next build`. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

export async function ensureDbDurability() {
  if (globalForPrisma.dbReady) return;
  globalForPrisma.dbReady = true;
}

export async function ensureAppSettings() {
  await ensureDataDirs();
  await ensureDbDurability();
  await prisma.appSetting.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}

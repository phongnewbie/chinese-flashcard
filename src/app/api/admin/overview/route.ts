import { requireAdmin } from "@/lib/api-auth";
import { prisma, ensureAppSettings } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  await ensureAppSettings();
  const [settings, users, courses, deviceCount] = await Promise.all([
    prisma.appSetting.findUniqueOrThrow({ where: { id: "default" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { devices: true, _count: { select: { devices: true } } },
    }),
    prisma.course.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { _count: { select: { cards: true } } },
    }),
    prisma.device.count(),
  ]);

  return NextResponse.json({ settings, users, courses, deviceCount });
}

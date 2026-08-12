import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const [today, week, total, logs] = await Promise.all([
    prisma.reviewLog.count({
      where: { userId, reviewedAt: { gte: todayStart } },
    }),
    prisma.reviewLog.count({
      where: { userId, reviewedAt: { gte: weekStart } },
    }),
    prisma.reviewLog.count({ where: { userId } }),
    prisma.reviewLog.findMany({
      where: { userId },
      select: { reviewedAt: true },
      orderBy: { reviewedAt: "desc" },
      take: 400,
    }),
  ]);

  const daySet = new Set<string>();
  for (const l of logs) {
    daySet.add(startOfDay(l.reviewedAt).toISOString());
  }
  const sortedDays = [...daySet].sort().reverse();
  let streak = 0;
  let cursor = todayStart;
  for (const dayIso of sortedDays) {
    if (dayIso === cursor.toISOString()) {
      streak++;
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() - 1);
    } else if (new Date(dayIso) < cursor) {
      break;
    }
  }

  return NextResponse.json({ today, week, total, streak });
}

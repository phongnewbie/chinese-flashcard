import { requireAdmin } from "@/lib/api-auth";
import { HSK_LEVELS } from "@/lib/hsk-levels";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [enrollments, courses] = await Promise.all([
    prisma.userHskLevel.findMany({
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.course.findMany({
      where: { hskLevel: { not: null } },
      orderBy: [{ hskLevel: "asc" }, { primarySection: "asc" }, { lessonNumber: "asc" }],
      include: { _count: { select: { cards: true } } },
    }),
  ]);

  const usersByLevel: Record<string, { id: string; userId: string; email: string; name: string | null }[]> = {};
  for (const level of HSK_LEVELS) {
    usersByLevel[level.id] = [];
  }
  for (const e of enrollments) {
    if (!usersByLevel[e.hskLevel]) usersByLevel[e.hskLevel] = [];
    usersByLevel[e.hskLevel].push({
      id: e.id,
      userId: e.userId,
      email: e.user.email,
      name: e.user.name,
    });
  }

  const coursesByLevel: Record<string, typeof courses> = {};
  for (const level of HSK_LEVELS) {
    coursesByLevel[level.id] = courses.filter((c) => c.hskLevel === level.id);
  }

  return NextResponse.json({ levels: HSK_LEVELS, usersByLevel, coursesByLevel });
}

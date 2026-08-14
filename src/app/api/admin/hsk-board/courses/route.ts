import { requireAdmin } from "@/lib/api-auth";
import {
  categoriesForLevel,
  defaultLessonTitle,
  HSK_LEVELS,
  type HskCategoryId,
} from "@/lib/hsk-levels";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = (await req.json()) as {
    hskLevel?: string;
    primarySection?: string;
    lessonNumber?: number;
    title?: string;
  };

  const hskLevel = body.hskLevel?.trim();
  const primarySection = body.primarySection?.trim() as HskCategoryId | undefined;

  if (!hskLevel || !HSK_LEVELS.some((l) => l.id === hskLevel)) {
    return NextResponse.json({ error: "Cấp HSK không hợp lệ" }, { status: 400 });
  }
  const allowed = categoriesForLevel(hskLevel);
  if (!primarySection || !allowed.some((c) => c.id === primarySection)) {
    return NextResponse.json({ error: "Danh mục không hợp lệ cho cấp này" }, { status: 400 });
  }

  const maxLesson = await prisma.course.aggregate({
    where: { hskLevel, primarySection },
    _max: { lessonNumber: true },
  });
  const lessonNumber = body.lessonNumber ?? (maxLesson._max.lessonNumber ?? 0) + 1;
  const title =
    body.title?.trim() || defaultLessonTitle(hskLevel, primarySection, lessonNumber);

  const maxOrder = await prisma.course.aggregate({ _max: { sortOrder: true } });

  const course = await prisma.course.create({
    data: {
      title,
      hskLevel,
      primarySection,
      lessonNumber,
      published: true,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
    include: { _count: { select: { cards: true } } },
  });

  return NextResponse.json(course);
}

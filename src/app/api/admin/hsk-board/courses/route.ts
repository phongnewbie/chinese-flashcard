import {
  categoriesForLevel,
  HSK_LEVELS,
  type HskCategoryId,
} from "@/lib/hsk-levels";
import { requireAdmin } from "@/lib/api-auth";
import { courseDefaultsForSection } from "@/lib/section-presets";
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
  const customTitle = body.title?.trim();
  if (!customTitle) {
    return NextResponse.json({ error: "Vui lòng nhập tên bộ thẻ" }, { status: 400 });
  }
  const title = customTitle;

  const maxOrder = await prisma.course.aggregate({ _max: { sortOrder: true } });
  const defaults = courseDefaultsForSection(primarySection);

  const course = await prisma.course.create({
    data: {
      title,
      hskLevel,
      primarySection,
      lessonNumber,
      published: true,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      fieldDefs: defaults.fieldDefs,
      frontTemplate: defaults.frontTemplate,
      backTemplate: defaults.backTemplate,
      cardCss: defaults.cardCss,
      cardTypes: defaults.cardTypes,
    },
    include: { _count: { select: { cards: true } } },
  });

  return NextResponse.json(course);
}

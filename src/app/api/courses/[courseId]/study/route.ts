import { auth } from "@/auth";
import { getAccessStatus } from "@/lib/access";
import { parseCourseCardTypes } from "@/lib/card-types";
import { getCourseTemplates } from "@/lib/card-template";
import { ensureAppSettings, prisma } from "@/lib/db";
import { canAccessCourse } from "@/lib/hsk-enrollment";
import { buildStudyQueue } from "@/lib/study-queue";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getAccessStatus(session.user.id);
  if (!access.allowed) {
    return NextResponse.json({ error: "locked", access }, { status: 403 });
  }

  const { courseId } = await context.params;

  const allowed = await canAccessCourse(session.user.id, session.user.email, courseId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const section = url.searchParams.get("section") ?? "vocabulary";
  const mode = (url.searchParams.get("mode") ?? "review") as "review" | "new" | "all";

  await ensureAppSettings();
  const settings = await prisma.appSetting.findUniqueOrThrow({ where: { id: "default" } });

  const course = await prisma.course.findFirst({
    where: { id: courseId, published: true },
    include: {
      cards: {
        where: { section },
        orderBy: [{ sortOrder: "asc" }, { front: "asc" }],
      },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cardTypes = parseCourseCardTypes(course.cardTypes, section);
  const cardIds = course.cards.map((c) => c.id);

  const reviews = await prisma.cardReview.findMany({
    where: { userId: session.user.id, cardId: { in: cardIds } },
  });

  const { queue, stats } = buildStudyQueue({
    cards: course.cards,
    cardTypes,
    reviews,
    mode,
    maxNew: settings.maxNewPerDay,
  });

  const templates = getCourseTemplates(course);

  return NextResponse.json({
    courseId: course.id,
    title: course.title,
    section,
    mode,
    stats,
    cardTypes,
    templates,
    cards: queue.map(({ srs, cardType, cardTypeLabel, ...card }) => ({
      ...card,
      cardType,
      cardTypeLabel,
      srs,
    })),
  });
}

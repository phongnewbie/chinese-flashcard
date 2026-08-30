import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { requireStudyAccess } from "@/lib/study-access";
import { parseCourseCardTypes } from "@/lib/card-types";
import { getCourseTemplates } from "@/lib/card-template";
import { parseSectionTemplates } from "@/lib/section-templates";
import { ensureAppSettings, prisma } from "@/lib/db";
import { canAccessCourse } from "@/lib/hsk-enrollment";
import { buildStudyQueue } from "@/lib/study-queue";
import { lockedSectionForCourse, type StudySectionId } from "@/lib/sections";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { access, error: accessError } = await requireStudyAccess(session.user.id, session.user.email);
  if (accessError) return accessError;

  const { courseId } = await context.params;

  const rawAdmin =
    Boolean(session.user.email && isAdminEmail(session.user.email)) || access.isAdmin;
  const allowed =
    rawAdmin ||
    (await canAccessCourse(session.user.id, session.user.email, courseId));
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "review") as "review" | "new" | "all";

  await ensureAppSettings();
  const settings = await prisma.appSetting.findUniqueOrThrow({ where: { id: "default" } });

  const course = await prisma.course.findFirst({
    where: rawAdmin ? { id: courseId } : { id: courseId, published: true },
  });

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const locked = lockedSectionForCourse(course);
  const section = (locked ??
    (url.searchParams.get("section") as StudySectionId | null) ??
    "vocabulary") as StudySectionId;

  if (locked) {
    const misplaced = await prisma.flashcard.count({
      where: { courseId, NOT: { section: locked } },
    });
    if (misplaced > 0) {
      const inSection = await prisma.flashcard.count({
        where: { courseId, section: locked },
      });
      if (inSection === 0) {
        await prisma.flashcard.updateMany({
          where: { courseId, NOT: { section: locked } },
          data: { section: locked },
        });
      }
    }
  }

  const courseWithCards = await prisma.course.findFirst({
    where: rawAdmin ? { id: courseId } : { id: courseId, published: true },
    include: {
      cards: {
        where: { section },
        orderBy: [{ sortOrder: "asc" }, { front: "asc" }],
      },
    },
  });

  if (!courseWithCards) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cardTypes = parseCourseCardTypes(courseWithCards.cardTypes, section);
  const cardIds = courseWithCards.cards.map((c) => c.id);

  const reviews = await prisma.cardReview.findMany({
    where: { userId: session.user.id, cardId: { in: cardIds } },
  });

  const { queue, stats } = buildStudyQueue({
    cards: courseWithCards.cards,
    cardTypes,
    reviews,
    mode,
    maxNew: settings.maxNewPerDay,
  });

  const globalTemplates = parseSectionTemplates(settings.sectionTemplates);
  const templates = getCourseTemplates(courseWithCards, globalTemplates);

  return NextResponse.json({
    courseId: courseWithCards.id,
    title: courseWithCards.title,
    section,
    primarySection: courseWithCards.primarySection,
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

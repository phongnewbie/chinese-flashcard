import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { getAccessStatus } from "@/lib/access";
import { parseCourseCardTypes } from "@/lib/card-types";
import { getCourseTemplates } from "@/lib/card-template";
import { parseSectionTemplates } from "@/lib/section-templates";
import { ensureAppSettings, prisma } from "@/lib/db";
import { canAccessCourse } from "@/lib/hsk-enrollment";
import { buildStudyQueue } from "@/lib/study-queue";
import { lockedSectionForCourse, type StudySectionId } from "@/lib/sections";
import { readStudentPreviewCookie } from "@/lib/student-preview";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getAccessStatus(session.user.id, session.user.email);
  if (!access.allowed) {
    return NextResponse.json({ error: "locked", access }, { status: 403 });
  }

  const { courseId } = await context.params;

  const rawAdmin = session.user.email ? isAdminEmail(session.user.email) : false;
  const studentPreview = await readStudentPreviewCookie();

  let allowed = await canAccessCourse(session.user.id, session.user.email, courseId);
  if (rawAdmin && studentPreview) {
    allowed = await canAccessCourse(session.user.id, null, courseId);
  }
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "review") as "review" | "new" | "all";

  await ensureAppSettings();
  const settings = await prisma.appSetting.findUniqueOrThrow({ where: { id: "default" } });

  const course = await prisma.course.findFirst({
    where: { id: courseId, published: true },
  });

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const locked = lockedSectionForCourse(course);
  const section = (locked ??
    (url.searchParams.get("section") as StudySectionId | null) ??
    "vocabulary") as StudySectionId;

  const courseWithCards = await prisma.course.findFirst({
    where: { id: courseId, published: true },
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

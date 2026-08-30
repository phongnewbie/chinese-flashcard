import { auth } from "@/auth";
import { requireStudyAccess } from "@/lib/study-access";
import { canAccessCourse } from "@/lib/hsk-enrollment";
import { prisma } from "@/lib/db";
import { STUDY_SECTIONS, type StudySectionId } from "@/lib/sections";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ courseId: string }> };

function buildSectionCounts(cards: { section: string }[]) {
  const counts = Object.fromEntries(
    STUDY_SECTIONS.map((s) => [s.id, 0]),
  ) as Record<StudySectionId, number>;
  for (const c of cards) {
    const key = c.section as StudySectionId;
    if (key in counts) counts[key] += 1;
    else counts.vocabulary += 1;
  }
  return counts;
}

export async function GET(_req: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: accessError } = await requireStudyAccess(session.user.id, session.user.email);
  if (accessError) return accessError;

  const { courseId } = await context.params;

  const allowed = await canAccessCourse(session.user.id, session.user.email, courseId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const course = await prisma.course.findFirst({
    where: { id: courseId, published: true },
    include: {
      cards: { orderBy: [{ sortOrder: "asc" }, { front: "asc" }] },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { cards, ...rest } = course;
  return NextResponse.json({
    ...rest,
    cards,
    sectionCounts: buildSectionCounts(cards),
  });
}

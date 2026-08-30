import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { statsForCourse, sumDeckStats, type DeckCountStats } from "@/lib/deck-overview-stats";
import { getStudentHskLevels } from "@/lib/hsk-enrollment";
import { categoriesForLevel, HSK_LEVELS } from "@/lib/hsk-levels";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const isAdmin = session.user.email ? isAdminEmail(session.user.email) : false;
  const enrolledLevels = isAdmin ? HSK_LEVELS.map((l) => l.id) : await getStudentHskLevels(userId);
  const hskRestricted = !isAdmin && enrolledLevels.length > 0;

  const courses = await prisma.course.findMany({
    where: { published: true, hskLevel: { not: null } },
    orderBy: [
      { hskLevel: "asc" },
      { primarySection: "asc" },
      { sortOrder: "asc" },
      { lessonNumber: "asc" },
    ],
    include: {
      cards: {
        orderBy: [{ sortOrder: "asc" }, { front: "asc" }],
      },
    },
  });

  const cardIds = courses.flatMap((c) => c.cards.map((card) => card.id));
  const reviews =
    cardIds.length === 0
      ? []
      : await prisma.cardReview.findMany({
          where: { userId, cardId: { in: cardIds } },
        });

  const reviewsByCard = new Map<string, typeof reviews>();
  for (const r of reviews) {
    const list = reviewsByCard.get(r.cardId) ?? [];
    list.push(r);
    reviewsByCard.set(r.cardId, list);
  }

  type DeckRow = {
    id: string;
    title: string;
    hskLevel: string;
    primarySection: string;
    sortOrder: number;
    cardCount: number;
    stats: DeckCountStats;
  };

  const deckRows: DeckRow[] = courses.map((course) => {
    const section = course.primarySection ?? "vocabulary";
    const sectionCards = course.cards.filter((c) => c.section === section);
    const courseReviews = sectionCards.flatMap((c) => reviewsByCard.get(c.id) ?? []);
    const stats = statsForCourse({ ...course, cards: sectionCards }, courseReviews);
    return {
      id: course.id,
      title: course.title,
      hskLevel: course.hskLevel!,
      primarySection: course.primarySection ?? "vocabulary",
      sortOrder: course.sortOrder,
      cardCount: sectionCards.length,
      stats,
    };
  });

  const levels = HSK_LEVELS.map((level) => {
    const levelDecks = deckRows.filter((d) => d.hskLevel === level.id);
    const categories = categoriesForLevel(level.id).map((cat) => {
      const catDecks = levelDecks.filter((d) => d.primarySection === cat.id);
      return {
        id: cat.id,
        label: cat.label,
        stats: sumDeckStats(catDecks.map((d) => d.stats)),
        decks: catDecks,
      };
    });
    return {
      id: level.id,
      label: level.label.toUpperCase(),
      locked: hskRestricted && !enrolledLevels.includes(level.id),
      stats: sumDeckStats(levelDecks.map((d) => d.stats)),
      categories,
    };
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const studiedToday = await prisma.reviewLog.count({
    where: { userId, reviewedAt: { gte: todayStart } },
  });

  return NextResponse.json({
    isAdmin,
    enrolledLevels,
    hskRestricted,
    levels,
    studiedToday,
  });
}

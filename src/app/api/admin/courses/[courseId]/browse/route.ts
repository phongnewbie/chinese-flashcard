import { requireAdmin } from "@/lib/api-auth";
import { parseAnkiSearch } from "@/lib/anki-search";
import { cardTypeCount } from "@/lib/card-types";
import { parseExtraFields } from "@/lib/fields";
import { sectionLabel, type StudySectionId } from "@/lib/sections";
import { cardMatchesDeckFilter, cardMatchesTag } from "@/lib/study-queue";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { courseId } = await context.params;
  const url = new URL(req.url);
  const section = url.searchParams.get("section")?.trim() ?? "";
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 200)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  const cardState = url.searchParams.get("state") ?? "";
  const searchRaw = url.searchParams.get("q")?.trim() ?? "";

  const parsed = parseAnkiSearch(searchRaw);
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const needsMemoryFilter =
    !!parsed.deck ||
    !!parsed.tag ||
    !!parsed.subdeck ||
    parsed.isSuspended ||
    parsed.isNew ||
    parsed.isLearning ||
    parsed.isReview ||
    !!cardState;

  const where: Prisma.FlashcardWhereInput = { courseId };
  if (section) where.section = section;
  if (parsed.flag !== null) where.flag = parsed.flag;
  if (parsed.text) {
    where.OR = [
      { front: { contains: parsed.text } },
      { back: { contains: parsed.text } },
      { pinyin: { contains: parsed.text } },
      { extraFields: { contains: parsed.text } },
      { subdeck: { contains: parsed.text } },
    ];
  }

  const bySection = await prisma.flashcard.groupBy({
    by: ["section"],
    where: { courseId },
    _count: { id: true },
  });

  const subdeckRows = await prisma.flashcard.findMany({
    where: { courseId, subdeck: { not: null } },
    select: { section: true, subdeck: true },
    distinct: ["section", "subdeck"],
    orderBy: [{ section: "asc" }, { subdeck: "asc" }],
  });

  const subdecksBySection: Record<string, string[]> = {};
  const bySubdeck: Record<string, number> = {};
  for (const r of subdeckRows) {
    if (!r.subdeck?.trim()) continue;
    const name = r.subdeck.trim();
    if (!subdecksBySection[r.section]) subdecksBySection[r.section] = [];
    if (!subdecksBySection[r.section]!.includes(name)) {
      subdecksBySection[r.section]!.push(name);
    }
  }

  const subdeckCounts = await prisma.flashcard.groupBy({
    by: ["section", "subdeck"],
    where: { courseId, subdeck: { not: null } },
    _count: { id: true },
  });
  for (const row of subdeckCounts) {
    if (!row.subdeck?.trim()) continue;
    bySubdeck[`${row.section}:${row.subdeck.trim()}`] = row._count.id;
  }

  const subdecks = Object.values(subdecksBySection).flat();

  if (!needsMemoryFilter) {
    const total = await prisma.flashcard.count({ where });
    const page = await prisma.flashcard.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { front: "asc" }],
      skip: offset,
      take: limit,
    });

    const cardsWithMeta = page.map((c) => ({
      ...c,
      cardCount: cardTypeCount(c.section, course.cardTypes),
      tags: parseExtraFields(c.extraFields).Tags ?? "",
    }));

    return NextResponse.json({
      cards: cardsWithMeta,
      total,
      bySection: Object.fromEntries(bySection.map((r) => [r.section, r._count.id])),
      subdecks,
      subdecksBySection,
      bySubdeck,
    });
  }

  let cards = await prisma.flashcard.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { front: "asc" }],
  });

  if (parsed.deck) {
    cards = cards.filter((c) =>
      cardMatchesDeckFilter(c, sectionLabel(c.section as StudySectionId), parsed.deck),
    );
  }
  if (parsed.tag) {
    cards = cards.filter((c) => cardMatchesTag(c, parsed.tag));
  }
  if (parsed.subdeck) {
    const q = parsed.subdeck.toLowerCase();
    cards = cards.filter((c) => c.subdeck?.toLowerCase().includes(q));
  }

  const cardIds = cards.map((c) => c.id);
  const allReviews = cardIds.length
    ? await prisma.cardReview.findMany({ where: { cardId: { in: cardIds } } })
    : [];

  const reviewByCard = new Map<string, typeof allReviews>();
  for (const r of allReviews) {
    const list = reviewByCard.get(r.cardId) ?? [];
    list.push(r);
    reviewByCard.set(r.cardId, list);
  }

  if (parsed.isSuspended) {
    cards = cards.filter((c) => reviewByCard.get(c.id)?.some((r) => r.suspended));
  }
  if (parsed.isNew) {
    cards = cards.filter((c) => !reviewByCard.has(c.id) || reviewByCard.get(c.id)!.length === 0);
  }
  if (parsed.isLearning) {
    cards = cards.filter((c) =>
      reviewByCard.get(c.id)?.some((r) => !r.suspended && r.intervalDays === 0),
    );
  }
  if (parsed.isReview) {
    cards = cards.filter((c) =>
      reviewByCard.get(c.id)?.some((r) => !r.suspended && r.intervalDays > 0),
    );
  }
  if (cardState === "suspended") {
    cards = cards.filter((c) => reviewByCard.get(c.id)?.some((r) => r.suspended));
  }
  if (cardState === "new") {
    cards = cards.filter((c) => !reviewByCard.has(c.id) || reviewByCard.get(c.id)!.length === 0);
  }
  if (cardState === "learning") {
    cards = cards.filter((c) =>
      reviewByCard.get(c.id)?.some((r) => !r.suspended && r.intervalDays === 0),
    );
  }
  if (cardState === "review") {
    cards = cards.filter((c) =>
      reviewByCard.get(c.id)?.some((r) => !r.suspended && r.intervalDays > 0),
    );
  }

  const total = cards.length;
  const page = cards.slice(offset, offset + limit);

  const cardsWithMeta = page.map((c) => ({
    ...c,
    cardCount: cardTypeCount(c.section, course.cardTypes),
    tags: parseExtraFields(c.extraFields).Tags ?? "",
  }));

  return NextResponse.json({
    cards: cardsWithMeta,
    total,
    bySection: Object.fromEntries(bySection.map((r) => [r.section, r._count.id])),
    subdecks,
    subdecksBySection,
    bySubdeck,
  });
}

import { parseCourseCardTypes, type CardTypeDef } from "@/lib/card-types";
import { isDue } from "@/lib/srs";
import type { ReviewRow } from "@/lib/study-queue";

export type DeckCountStats = {
  new: number;
  learning: number;
  due: number;
  /** Số từ/câu trong bộ (một dòng Excel = một đơn vị) */
  total: number;
};

export function emptyDeckStats(): DeckCountStats {
  return { new: 0, learning: 0, due: 0, total: 0 };
}

export function sumDeckStats(items: DeckCountStats[]): DeckCountStats {
  return items.reduce(
    (acc, s) => ({
      new: acc.new + s.new,
      learning: acc.learning + s.learning,
      due: acc.due + s.due,
      total: acc.total + s.total,
    }),
    emptyDeckStats(),
  );
}

function reviewKey(cardId: string, cardType: string) {
  return `${cardId}:${cardType}`;
}

type TypeStatus = "new" | "learning" | "due" | "ok" | "skip";

function classifyType(
  cardId: string,
  cardType: CardTypeDef,
  reviewMap: Map<string, ReviewRow>,
  now: Date,
): TypeStatus {
  const r = reviewMap.get(reviewKey(cardId, cardType.id));
  if (r?.suspended) return "skip";
  if (r?.buriedUntil && r.buriedUntil.getTime() > now.getTime()) return "skip";

  if (!r) return "new";

  const learning = r.intervalDays === 0;
  if (learning) {
    return isDue(r.dueAt, now) ? "due" : "learning";
  }

  return isDue(r.dueAt, now) ? "due" : "ok";
}

/** Gom theo từ/câu — không nhân đôi vì có 2 kiểu thẻ (Việt→Trung + Trung→Việt) */
function bucketForNote(
  cardId: string,
  cardTypes: CardTypeDef[],
  reviewMap: Map<string, ReviewRow>,
  now: Date,
): "new" | "learning" | "due" | "ok" {
  const statuses = cardTypes.map((ct) => classifyType(cardId, ct, reviewMap, now));
  const active = statuses.filter((s) => s !== "skip");
  if (active.length === 0) return "ok";

  if (active.some((s) => s === "due")) return "due";
  if (active.some((s) => s === "learning")) return "learning";
  if (active.every((s) => s === "new")) return "new";
  if (active.some((s) => s === "new")) return "learning";
  return "ok";
}

export function statsForCourse(
  course: {
    primarySection: string | null;
    cardTypes: string | null;
    cards: { id: string; section: string }[];
  },
  reviews: ReviewRow[],
): DeckCountStats {
  const section = course.primarySection ?? "vocabulary";
  const sectionCards = course.cards.filter((c) => c.section === section);
  if (sectionCards.length === 0) return emptyDeckStats();

  const cardTypes = parseCourseCardTypes(course.cardTypes, section);
  const reviewMap = new Map(reviews.map((r) => [reviewKey(r.cardId, r.cardType), r]));
  const now = new Date();

  let newCount = 0;
  let learningCount = 0;
  let dueCount = 0;

  for (const card of sectionCards) {
    const bucket = bucketForNote(card.id, cardTypes, reviewMap, now);
    if (bucket === "new") newCount++;
    else if (bucket === "learning") learningCount++;
    else if (bucket === "due") dueCount++;
  }

  return {
    new: newCount,
    learning: learningCount,
    due: dueCount,
    total: sectionCards.length,
  };
}

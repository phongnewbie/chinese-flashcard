import { parseCourseCardTypes } from "@/lib/card-types";
import { buildStudyQueue, type FlashcardRow, type ReviewRow } from "@/lib/study-queue";

export type DeckCountStats = {
  new: number;
  learning: number;
  due: number;
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

export function statsForCourse(
  course: {
    primarySection: string | null;
    cardTypes: string | null;
    cards: FlashcardRow[];
  },
  reviews: ReviewRow[],
  maxNew = 20,
): DeckCountStats {
  const section = course.primarySection ?? "vocabulary";
  const sectionCards = course.cards.filter((c) => c.section === section);
  if (sectionCards.length === 0) return emptyDeckStats();
  const cardTypes = parseCourseCardTypes(course.cardTypes, section);
  const { stats } = buildStudyQueue({
    cards: sectionCards,
    cardTypes,
    reviews,
    mode: "review",
    maxNew,
  });
  return {
    new: stats.new,
    learning: stats.learning,
    due: stats.due,
    total: stats.total,
  };
}

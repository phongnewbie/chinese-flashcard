import { parseExtraFields } from "@/lib/fields";
import { isDue, defaultReviewState, type ReviewState } from "@/lib/srs";
import { parseCourseCardTypes, type CardTypeDef } from "@/lib/card-types";

export type FlashcardRow = {
  id: string;
  courseId: string;
  section: string;
  front: string;
  back: string;
  pinyin: string | null;
  audioUrl: string | null;
  extraFields: string | null;
  sortOrder: number;
  flag: number;
  subdeck: string | null;
};

export type ReviewRow = {
  id: string;
  cardId: string;
  cardType: string;
  ease: number;
  intervalDays: number;
  repetitions: number;
  learningStep: number;
  dueAt: Date;
  suspended: boolean;
  buriedUntil: Date | null;
};

export type QueueCard = FlashcardRow & {
  cardType: string;
  cardTypeLabel: string;
  srs: ReviewState & { id?: string; isNew: boolean; suspended: boolean };
};

export function expandCardsWithTypes(
  cards: FlashcardRow[],
  cardTypes: CardTypeDef[],
): Array<{ card: FlashcardRow; cardType: CardTypeDef }> {
  const out: Array<{ card: FlashcardRow; cardType: CardTypeDef }> = [];
  for (const card of cards) {
    for (const ct of cardTypes) {
      out.push({ card, cardType: ct });
    }
  }
  return out;
}

function reviewKey(cardId: string, cardType: string) {
  return `${cardId}:${cardType}`;
}

export function buildStudyQueue(opts: {
  cards: FlashcardRow[];
  cardTypes: CardTypeDef[];
  reviews: ReviewRow[];
  mode: "review" | "new" | "all";
  maxNew: number;
  now?: Date;
}): { queue: QueueCard[]; stats: { total: number; due: number; new: number; learning: number; queue: number } } {
  const now = opts.now ?? new Date();
  const reviewMap = new Map(opts.reviews.map((r) => [reviewKey(r.cardId, r.cardType), r]));

  const expanded = expandCardsWithTypes(opts.cards, opts.cardTypes);

  const enriched: QueueCard[] = expanded.map(({ card, cardType }) => {
    const r = reviewMap.get(reviewKey(card.id, cardType.id));
    if (!r) {
      return {
        ...card,
        cardType: cardType.id,
        cardTypeLabel: cardType.label,
        srs: { ...defaultReviewState(now), isNew: true, suspended: false },
      };
    }
    return {
      ...card,
      cardType: cardType.id,
      cardTypeLabel: cardType.label,
      srs: {
        ease: r.ease,
        intervalDays: r.intervalDays,
        repetitions: r.repetitions,
        learningStep: r.learningStep,
        dueAt: r.dueAt,
        id: r.id,
        isNew: false,
        suspended: r.suspended,
      },
    };
  });

  const active = enriched.filter((c) => {
    if (c.srs.suspended) return false;
    const r = reviewMap.get(reviewKey(c.id, c.cardType));
    if (r?.buriedUntil && r.buriedUntil.getTime() > now.getTime()) return false;
    return true;
  });

  const learning = active.filter((c) => !c.srs.isNew && c.srs.intervalDays === 0 && !c.srs.suspended);
  const dueGraduated = active.filter(
    (c) => !c.srs.isNew && c.srs.intervalDays > 0 && isDue(c.srs.dueAt, now),
  );
  const newCards = active.filter((c) => c.srs.isNew);

  let queue: QueueCard[];
  if (opts.mode === "all") {
    queue = active;
  } else if (opts.mode === "new") {
    queue = newCards.slice(0, opts.maxNew);
  } else {
    // review mode: learning due first, then review due, then new (capped)
    const learningDue = learning.filter((c) => isDue(c.srs.dueAt, now));
    const newBatch = newCards.slice(0, opts.maxNew);
    queue = [...learningDue, ...dueGraduated, ...newBatch];
  }

  const stats = {
    total: enriched.length,
    due: dueGraduated.length + learning.filter((c) => isDue(c.srs.dueAt, now)).length,
    new: newCards.length,
    learning: learning.length,
    queue: queue.length,
  };

  return { queue, stats };
}

export function cardMatchesTag(card: FlashcardRow, tag: string): boolean {
  if (!tag) return true;
  const extras = parseExtraFields(card.extraFields);
  const tags = (extras.Tags ?? extras.tags ?? "").toLowerCase();
  return tags.split(/\s+/).includes(tag.toLowerCase());
}

export function cardMatchesDeckFilter(
  card: FlashcardRow,
  sectionLabel: string,
  deckFilter: string,
): boolean {
  if (!deckFilter) return true;
  const d = deckFilter.toLowerCase();
  if (card.subdeck?.toLowerCase().includes(d)) return true;
  if (sectionLabel.toLowerCase().includes(d)) return true;
  if (d.includes("hsk3") && card.section === "vocabulary") return true;
  if (d.includes("p") && card.subdeck?.toLowerCase().includes(d.replace(/\s/g, ""))) return true;
  return false;
}

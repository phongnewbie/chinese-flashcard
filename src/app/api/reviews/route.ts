import { auth } from "@/auth";
import { ensureAppSettings, prisma } from "@/lib/db";
import { parseLearningSteps } from "@/lib/card-types";
import { schedule, type SrsRating, previewIntervals, defaultReviewState } from "@/lib/srs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    cardId?: string;
    cardType?: string;
    rating?: number;
    suspend?: boolean;
    bury?: boolean;
    flag?: number;
  };

  if (!body.cardId) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }

  const cardType = body.cardType?.trim() || "default";
  const card = await prisma.flashcard.findUnique({ where: { id: body.cardId } });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  await ensureAppSettings();
  const settings = await prisma.appSetting.findUniqueOrThrow({ where: { id: "default" } });
  const learningSteps = parseLearningSteps(settings.learningSteps);

  if (typeof body.flag === "number" && body.flag >= 0 && body.flag <= 7) {
    await prisma.flashcard.update({ where: { id: body.cardId }, data: { flag: body.flag } });
  }

  const existing = await prisma.cardReview.findUnique({
    where: {
      userId_cardId_cardType: {
        userId: session.user.id,
        cardId: body.cardId,
        cardType,
      },
    },
  });

  if (body.suspend === true || body.suspend === false) {
    const saved = await prisma.cardReview.upsert({
      where: {
        userId_cardId_cardType: {
          userId: session.user.id,
          cardId: body.cardId,
          cardType,
        },
      },
      create: {
        userId: session.user.id,
        cardId: body.cardId,
        cardType,
        suspended: body.suspend,
        lastReviewAt: now,
      },
      update: { suspended: body.suspend },
    });
    return NextResponse.json({ ok: true, review: saved });
  }

  if (body.bury === true) {
    const until = new Date(now.getTime() + 86_400_000);
    const saved = await prisma.cardReview.upsert({
      where: {
        userId_cardId_cardType: {
          userId: session.user.id,
          cardId: body.cardId,
          cardType,
        },
      },
      create: {
        userId: session.user.id,
        cardId: body.cardId,
        cardType,
        buriedUntil: until,
        lastReviewAt: now,
      },
      update: { buriedUntil: until },
    });
    return NextResponse.json({ ok: true, review: saved });
  }

  if (![1, 2, 3, 4].includes(body.rating ?? 0)) {
    return NextResponse.json({ error: "rating (1-4) required" }, { status: 400 });
  }

  const rating = body.rating as SrsRating;

  const prev = existing
    ? {
        ease: existing.ease,
        intervalDays: existing.intervalDays,
        repetitions: existing.repetitions,
        learningStep: existing.learningStep,
        dueAt: existing.dueAt,
      }
    : defaultReviewState(now);

  const next = schedule(prev, rating, now, learningSteps);

  const saved = await prisma.cardReview.upsert({
    where: {
      userId_cardId_cardType: {
        userId: session.user.id,
        cardId: body.cardId,
        cardType,
      },
    },
    create: {
      userId: session.user.id,
      cardId: body.cardId,
      cardType,
      ease: next.ease,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      learningStep: next.learningStep,
      dueAt: next.dueAt,
      lastReviewAt: now,
      buriedUntil: null,
    },
    update: {
      ease: next.ease,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      learningStep: next.learningStep,
      dueAt: next.dueAt,
      lastReviewAt: now,
      buriedUntil: null,
    },
  });

  await prisma.reviewLog.create({
    data: {
      userId: session.user.id,
      cardId: body.cardId,
      cardType,
      rating,
    },
  });

  return NextResponse.json({
    ok: true,
    review: saved,
    previews: previewIntervals(next, now, learningSteps),
    requeueInMs: next.intervalDays === 0 ? Math.max(0, next.dueAt.getTime() - now.getTime()) : null,
  });
}

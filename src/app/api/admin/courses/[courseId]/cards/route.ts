import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { stringifyExtraFields } from "@/lib/fields";
import { NextResponse } from "next/server";
type RouteContext = { params: Promise<{ courseId: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { courseId } = await context.params;
  const body = (await req.json()) as {
    section?: string;
    front?: string;
    back?: string;
    pinyin?: string;
    audioUrl?: string;
    extraFields?: Record<string, string>;
  };

  if (!body.front?.trim() || !body.back?.trim()) {
    return NextResponse.json({ error: "front and back required" }, { status: 400 });
  }

  const maxOrder = await prisma.flashcard.aggregate({
    where: { courseId },
    _max: { sortOrder: true },
  });

  const card = await prisma.flashcard.create({
    data: {
      courseId,
      section: body.section?.trim() || "vocabulary",
      front: body.front.trim(),
      back: body.back.trim(),
      pinyin: body.pinyin?.trim() || null,
      audioUrl: body.audioUrl?.trim() || null,
      extraFields: body.extraFields ? stringifyExtraFields(body.extraFields) : null,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(card);
}

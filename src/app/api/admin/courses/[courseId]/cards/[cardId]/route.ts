import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { stringifyExtraFields } from "@/lib/fields";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ courseId: string; cardId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { courseId, cardId } = await context.params;
  const card = await prisma.flashcard.findFirst({ where: { id: cardId, courseId } });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(card);
}

export async function PATCH(req: Request, context: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { courseId, cardId } = await context.params;
  const body = (await req.json()) as {
    section?: string;
    front?: string;
    back?: string;
    pinyin?: string | null;
    audioUrl?: string | null;
    extraFields?: Record<string, string> | null;
    sortOrder?: number;
    flag?: number;
    subdeck?: string | null;
  };

  const existing = await prisma.flashcard.findFirst({ where: { id: cardId, courseId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const card = await prisma.flashcard.update({
    where: { id: cardId },
    data: {
      ...(body.section !== undefined ? { section: body.section } : {}),
      ...(body.front !== undefined ? { front: body.front.trim() } : {}),
      ...(body.back !== undefined ? { back: body.back.trim() } : {}),
      ...(body.pinyin !== undefined ? { pinyin: body.pinyin?.trim() || null } : {}),
      ...(body.audioUrl !== undefined ? { audioUrl: body.audioUrl?.trim() || null } : {}),
      ...(body.extraFields !== undefined
        ? { extraFields: body.extraFields ? stringifyExtraFields(body.extraFields) : null }
        : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      ...(body.flag !== undefined && body.flag >= 0 && body.flag <= 7 ? { flag: body.flag } : {}),
      ...(body.subdeck !== undefined ? { subdeck: body.subdeck?.trim() || null } : {}),
    },
  });
  return NextResponse.json(card);
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { courseId, cardId } = await context.params;
  const existing = await prisma.flashcard.findFirst({ where: { id: cardId, courseId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.flashcard.delete({ where: { id: cardId } });
  return NextResponse.json({ ok: true });
}

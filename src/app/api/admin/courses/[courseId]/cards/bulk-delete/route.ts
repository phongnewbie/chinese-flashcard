import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { courseId } = await context.params;
  const body = (await req.json()) as { ids?: string[] };

  const ids = [...new Set((body.ids ?? []).map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Chưa chọn thẻ nào" }, { status: 400 });
  }

  const existing = await prisma.flashcard.findMany({
    where: { courseId, id: { in: ids } },
    select: { id: true },
  });
  if (existing.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy thẻ trong bộ này" }, { status: 404 });
  }

  const existingIds = existing.map((c) => c.id);
  await prisma.flashcard.deleteMany({
    where: { courseId, id: { in: existingIds } },
  });

  return NextResponse.json({ ok: true, deleted: existingIds.length });
}

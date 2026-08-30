import { requireAdmin } from "@/lib/api-auth";
import { parseApkgWithMedia } from "@/lib/apkg-import";
import { stringifyExtraFields } from "@/lib/fields";
import type { StudySectionId } from "@/lib/sections";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { courseId } = await context.params;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  const section = (course.primarySection as StudySectionId | null) ?? "vocabulary";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let notes;
  let mediaImported = 0;
  try {
    const parsed = await parseApkgWithMedia(buf);
    notes = parsed.notes;
    mediaImported = parsed.mediaImported;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid apkg";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const filtered = notes.filter((n) => n.front && n.back);
  if (filtered.length === 0) {
    return NextResponse.json({ error: "Không có note hợp lệ trong apkg" }, { status: 400 });
  }

  const maxOrder = await prisma.flashcard.aggregate({
    where: { courseId },
    _max: { sortOrder: true },
  });
  let order = (maxOrder._max.sortOrder ?? 0) + 1;

  await prisma.flashcard.createMany({
    data: filtered.map((n) => ({
      courseId,
      section,
      front: n.front,
      back: n.back,
      pinyin: n.pinyin || null,
      audioUrl: n.audioUrl,
      extraFields: stringifyExtraFields({
        ...n.extras,
        ...(n.tags ? { Tags: n.tags } : {}),
      }),
      sortOrder: order++,
    })),
  });

  return NextResponse.json({ ok: true, imported: filtered.length, mediaImported });
}

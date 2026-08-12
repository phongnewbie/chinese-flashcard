import { requireAdmin } from "@/lib/api-auth";
import {
  parseImportFile,
  resolveAudioUrl,
  type ImportPreview,
} from "@/lib/import-cards";
import { mergeFieldDefs, parseFieldDefs, stringifyExtraFields } from "@/lib/fields";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { courseId } = await context.params;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  const mode = String(form.get("mode") ?? "append");
  const preview = form.get("preview") === "true";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chọn file Excel hoặc Notepad" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const result: ImportPreview = parseImportFile(buffer, file.name);

  if (result.total === 0) {
    return NextResponse.json(
      {
        error: "Không đọc được câu hỏi nào. Kiểm tra tiêu đề cột hoặc định dạng file.",
        ...result,
      },
      { status: 400 },
    );
  }

  if (preview) {
    return NextResponse.json(result);
  }

  const replace = mode === "replace";
  const audioBase = "/uploads/audio";
  const maxOrder = await prisma.flashcard.aggregate({
    where: { courseId },
    _max: { sortOrder: true },
  });
  let order = replace ? 0 : (maxOrder._max.sortOrder ?? 0);

  await prisma.$transaction(async (tx) => {
    if (replace) {
      await tx.flashcard.deleteMany({ where: { courseId } });
      order = 0;
    }
    for (const card of result.cards) {
      order += 1;
      await tx.flashcard.create({
        data: {
          courseId,
          section: card.section,
          front: card.front,
          back: card.back,
          pinyin: card.pinyin ?? null,
          audioUrl: resolveAudioUrl(card.audioUrl, audioBase) ?? null,
          extraFields: stringifyExtraFields(card.extraFields ?? {}),
          sortOrder: order,
        },
      });
    }

    const mergedDefs = mergeFieldDefs(
      parseFieldDefs(course.fieldDefs),
      result.cards.map((c) => c.extraFields ?? {}),
    );
    if (mergedDefs.length > 0) {
      await tx.course.update({
        where: { id: courseId },
        data: { fieldDefs: JSON.stringify(mergedDefs) },
      });
    }
  });

  return NextResponse.json({
    imported: result.total,
    replace,
    bySection: result.bySection,
    detectedColumns: result.detectedColumns,
  });
}

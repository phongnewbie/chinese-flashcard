import { requireAdmin } from "@/lib/api-auth";
import {
  parseImportFile,
  resolveAudioUrl,
  type ImportPreview,
} from "@/lib/import-cards";
import { mergeFieldDefs, parseFieldDefs, stringifyExtraFields } from "@/lib/fields";
import { getSectionPreset } from "@/lib/section-presets";
import type { StudySectionId } from "@/lib/sections";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    return await handleImport(req, context);
  } catch (err) {
    console.error("[import]", err);
    const message =
      err instanceof Error && err.message.includes("transaction")
        ? "Import quá nhiều thẻ hoặc mạng chậm — thử lại hoặc chia file nhỏ hơn."
        : "Lỗi server khi import";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleImport(req: Request, context: RouteContext) {
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
  const result: ImportPreview = parseImportFile(
    buffer,
    file.name,
    (course.primarySection as StudySectionId | null) ?? undefined,
  );

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

  const rows = result.cards.map((card, i) => ({
    courseId,
    section: card.section,
    front: card.front,
    back: card.back,
    pinyin: card.pinyin ?? null,
    audioUrl: resolveAudioUrl(card.audioUrl, audioBase) ?? null,
    extraFields: stringifyExtraFields(card.extraFields ?? {}),
    sortOrder: order + i + 1,
  }));

  const mergedDefs = mergeFieldDefs(
    parseFieldDefs(course.fieldDefs).length > 0
      ? parseFieldDefs(course.fieldDefs)
      : getSectionPreset(course.primarySection ?? "vocabulary").fieldDefs.map((f) => f.name),
    result.cards.map((c) => c.extraFields ?? {}),
  );

  await prisma.$transaction(
    async (tx) => {
      if (replace) {
        await tx.flashcard.deleteMany({ where: { courseId } });
      }

      const BATCH = 500;
      for (let i = 0; i < rows.length; i += BATCH) {
        await tx.flashcard.createMany({ data: rows.slice(i, i + BATCH) });
      }

      if (mergedDefs.length > 0) {
        await tx.course.update({
          where: { id: courseId },
          data: { fieldDefs: JSON.stringify(mergedDefs) },
        });
      }
    },
    { timeout: 120_000 },
  );

  return NextResponse.json({
    imported: result.total,
    replace,
    bySection: result.bySection,
    detectedColumns: result.detectedColumns,
  });
}

import { requireAdmin } from "@/lib/api-auth";
import { parseExtraFields } from "@/lib/fields";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ courseId: string }> };

function csvEscape(s: string) {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(_req: Request, context: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { courseId } = await context.params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { cards: { orderBy: [{ sortOrder: "asc" }, { front: "asc" }] } },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const header = ["section", "front", "back", "pinyin", "tags", "subdeck", "audioUrl"];
  const lines = [header.join(",")];
  for (const c of course.cards) {
    const extras = parseExtraFields(c.extraFields);
    const tags = extras.Tags ?? extras.tags ?? "";
    lines.push(
      [
        c.section,
        c.front,
        c.back,
        c.pinyin ?? "",
        tags,
        c.subdeck ?? "",
        c.audioUrl ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const body = "\uFEFF" + lines.join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${course.title.replace(/[^\w\s-]/g, "")}.csv"`,
    },
  });
}

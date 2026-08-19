import { requireAdmin } from "@/lib/api-auth";
import { serializeFieldDefEntries, type FieldDefEntry } from "@/lib/field-defs";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { courseId } = await context.params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      cards: { orderBy: [{ sortOrder: "asc" }, { front: "asc" }] },
    },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(course);
}

export async function PATCH(req: Request, context: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { courseId } = await context.params;
  const body = (await req.json()) as {
    title?: string;
    description?: string;
    published?: boolean;
    frontTemplate?: string | null;
    backTemplate?: string | null;
    cardCss?: string | null;
    fieldDefs?: (string | FieldDefEntry)[] | null;
  };

  let fieldDefsStored: string | null | undefined;
  if (body.fieldDefs !== undefined) {
    if (!body.fieldDefs?.length) {
      fieldDefsStored = null;
    } else if (typeof body.fieldDefs[0] === "object") {
      fieldDefsStored = serializeFieldDefEntries(body.fieldDefs as FieldDefEntry[]);
    } else {
      fieldDefsStored = JSON.stringify(body.fieldDefs);
    }
  }

  const course = await prisma.course.update({
    where: { id: courseId },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined
        ? { description: body.description.trim() || null }
        : {}),
      ...(body.published !== undefined ? { published: body.published } : {}),
      ...(body.frontTemplate !== undefined ? { frontTemplate: body.frontTemplate } : {}),
      ...(body.backTemplate !== undefined ? { backTemplate: body.backTemplate } : {}),
      ...(body.cardCss !== undefined ? { cardCss: body.cardCss } : {}),
      ...(fieldDefsStored !== undefined ? { fieldDefs: fieldDefsStored } : {}),
    },
  });
  return NextResponse.json(course);
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { courseId } = await context.params;
  await prisma.course.delete({ where: { id: courseId } });
  return NextResponse.json({ ok: true });
}

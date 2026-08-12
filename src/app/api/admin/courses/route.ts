import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = (await req.json()) as {
    title?: string;
    description?: string;
    published?: boolean;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const maxOrder = await prisma.course.aggregate({ _max: { sortOrder: true } });
  const course = await prisma.course.create({
    data: {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      published: body.published ?? true,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(course);
}

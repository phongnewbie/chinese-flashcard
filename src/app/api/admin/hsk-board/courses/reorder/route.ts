import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/** Sắp xếp lại thứ tự bộ thẻ trong cùng cấp + danh mục (admin kéo thả) */
export async function PATCH(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = (await req.json()) as {
    hskLevel?: string;
    primarySection?: string;
    courseIds?: string[];
  };

  const { courseIds } = body;
  if (!courseIds?.length) {
    return NextResponse.json({ error: "Thiếu danh sách bộ thẻ" }, { status: 400 });
  }

  await prisma.$transaction(
    courseIds.map((id, index) =>
      prisma.course.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}

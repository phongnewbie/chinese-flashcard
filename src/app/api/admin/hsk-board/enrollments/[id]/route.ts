import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, context: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await context.params;
  await prisma.userHskLevel.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ deviceId: string }> };

export async function DELETE(_req: Request, context: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { deviceId } = await context.params;
  await prisma.device.delete({ where: { id: deviceId } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

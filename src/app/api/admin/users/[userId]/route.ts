import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { userId } = await context.params;
  const body = (await req.json()) as {
    isPremium?: boolean;
    canStudy?: boolean;
    canEditContent?: boolean;
    resetTrial?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (typeof body.isPremium === "boolean") data.isPremium = body.isPremium;
  if (typeof body.canStudy === "boolean") {
    data.canStudy = body.canStudy;
    data.isPremium = body.canStudy;
  }
  if (typeof body.canEditContent === "boolean") data.canEditContent = body.canEditContent;
  if (body.resetTrial) data.trialStartedAt = null;

  const user = await prisma.user.update({ where: { id: userId }, data });
  return NextResponse.json(user);
}

import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = (await req.json()) as {
    trialMinutes?: number;
    maxDevices?: number;
    maxNewPerDay?: number;
    learningSteps?: string;
    zaloUrl?: string;
    lockMessage?: string;
  };

  const data: Record<string, unknown> = {};
  if (typeof body.trialMinutes === "number" && body.trialMinutes >= 1) {
    data.trialMinutes = Math.min(24 * 60, Math.floor(body.trialMinutes));
  }
  if (typeof body.maxDevices === "number" && body.maxDevices >= 1) {
    data.maxDevices = Math.min(10, Math.floor(body.maxDevices));
  }
  if (typeof body.maxNewPerDay === "number" && body.maxNewPerDay >= 0) {
    data.maxNewPerDay = Math.min(500, Math.floor(body.maxNewPerDay));
  }
  if (typeof body.learningSteps === "string" && body.learningSteps.trim()) {
    data.learningSteps = body.learningSteps.trim();
  }
  if (typeof body.zaloUrl === "string") data.zaloUrl = body.zaloUrl.trim();
  if (typeof body.lockMessage === "string") data.lockMessage = body.lockMessage.trim();

  const settings = await prisma.appSetting.update({
    where: { id: "default" },
    data,
  });
  return NextResponse.json(settings);
}

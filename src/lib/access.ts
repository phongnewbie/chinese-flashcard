import { prisma, ensureAppSettings } from "@/lib/db";

export type AccessStatus = {
  allowed: boolean;
  reason?: "trial_expired" | "device_limit" | "not_logged_in" | "no_study_access";
  isPremium: boolean;
  canStudy: boolean;
  trialMinutes: number;
  trialStartedAt: string | null;
  remainingSeconds: number | null;
  zaloUrl: string;
  lockMessage: string;
};

export async function getAccessStatus(userId: string): Promise<AccessStatus> {
  await ensureAppSettings();
  const [user, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.appSetting.findUniqueOrThrow({ where: { id: "default" } }),
  ]);

  if (!user) {
    return {
      allowed: false,
      reason: "not_logged_in",
      isPremium: false,
      canStudy: false,
      trialMinutes: settings.trialMinutes,
      trialStartedAt: null,
      remainingSeconds: null,
      zaloUrl: settings.zaloUrl,
      lockMessage: settings.lockMessage,
    };
  }

  if (user.canStudy || user.isPremium) {
    return {
      allowed: true,
      isPremium: true,
      canStudy: true,
      trialMinutes: settings.trialMinutes,
      trialStartedAt: user.trialStartedAt?.toISOString() ?? null,
      remainingSeconds: null,
      zaloUrl: settings.zaloUrl,
      lockMessage: settings.lockMessage,
    };
  }

  let trialStartedAt = user.trialStartedAt;
  if (!trialStartedAt) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { trialStartedAt: new Date() },
    });
    trialStartedAt = updated.trialStartedAt!;
  }

  const elapsedMs = Date.now() - trialStartedAt.getTime();
  const trialMs = settings.trialMinutes * 60 * 1000;
  const remainingMs = trialMs - elapsedMs;
  const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

  if (remainingMs <= 0) {
    return {
      allowed: false,
      reason: "trial_expired",
      isPremium: false,
      canStudy: false,
      trialMinutes: settings.trialMinutes,
      trialStartedAt: trialStartedAt.toISOString(),
      remainingSeconds: 0,
      zaloUrl: settings.zaloUrl,
      lockMessage: settings.lockMessage,
    };
  }

  return {
    allowed: true,
    isPremium: false,
    canStudy: false,
    trialMinutes: settings.trialMinutes,
    trialStartedAt: trialStartedAt.toISOString(),
    remainingSeconds,
    zaloUrl: settings.zaloUrl,
    lockMessage: settings.lockMessage,
  };
}

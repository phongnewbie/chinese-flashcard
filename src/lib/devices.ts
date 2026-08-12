import { prisma, ensureAppSettings } from "@/lib/db";

export type DeviceRegisterResult =
  | { ok: true }
  | { ok: false; reason: "device_limit"; maxDevices: number };

export async function registerDevice(
  userId: string,
  deviceKey: string,
  userAgent?: string,
  label?: string,
): Promise<DeviceRegisterResult> {
  await ensureAppSettings();
  const settings = await prisma.appSetting.findUniqueOrThrow({
    where: { id: "default" },
  });

  const existing = await prisma.device.findUnique({
    where: { userId_deviceKey: { userId, deviceKey } },
  });

  if (existing) {
    await prisma.device.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date(), userAgent, label },
    });
    return { ok: true };
  }

  const count = await prisma.device.count({ where: { userId } });
  if (count >= settings.maxDevices) {
    return { ok: false, reason: "device_limit", maxDevices: settings.maxDevices };
  }

  await prisma.device.create({
    data: { userId, deviceKey, userAgent, label },
  });
  return { ok: true };
}

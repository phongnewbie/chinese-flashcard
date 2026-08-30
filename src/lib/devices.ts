import { prisma, ensureAppSettings } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin";

export type DeviceRegisterResult =
  | { ok: true }
  | { ok: false; reason: "device_limit"; maxDevices: number };

export async function registerDevice(
  userId: string,
  deviceKey: string,
  userAgent?: string,
  label?: string,
  email?: string | null,
): Promise<DeviceRegisterResult> {
  if (email && isAdminEmail(email)) {
    const existing = await prisma.device.findUnique({
      where: { userId_deviceKey: { userId, deviceKey } },
    });
    if (existing) {
      await prisma.device.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), userAgent, label },
      });
    } else {
      await prisma.device.create({
        data: { userId, deviceKey, userAgent, label },
      });
    }
    return { ok: true };
  }

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

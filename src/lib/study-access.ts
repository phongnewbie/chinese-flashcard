import type { AccessStatus } from "@/lib/access";
import { getAccessStatus } from "@/lib/access";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/** Kiểm tra quyền gọi API học — admin / editor / premium không bị khóa học thử. */
export async function requireStudyAccess(userId: string, sessionEmail?: string | null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, canEditContent: true },
  });
  const email = sessionEmail ?? user?.email ?? null;
  const access = await getAccessStatus(userId, email);
  const admin = Boolean(email && isAdminEmail(email));

  if (access.allowed || access.isAdmin || admin || user?.canEditContent) {
    return { access: admin && !access.isAdmin ? { ...access, allowed: true, isAdmin: true } : access, error: null as null };
  }

  return {
    access,
    error: NextResponse.json({ error: "locked", access }, { status: 403 }),
  };
}

export function isStudyUnlocked(access: AccessStatus | null | undefined): boolean {
  if (!access) return false;
  return access.allowed || access.isAdmin || access.canStudy || access.isPremium;
}

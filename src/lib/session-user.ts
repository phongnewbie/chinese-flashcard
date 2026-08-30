import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/password";

/** JWT đôi khi giữ userId cũ sau khi DB đổi — tra cứu lại theo email. */
export async function resolveSessionUserId(
  userId: string,
  email?: string | null,
): Promise<string | null> {
  const byId = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (byId) return byId.id;

  const normalized = email ? normalizeEmail(email) : "";
  if (!normalized) return null;

  const byEmail = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  return byEmail?.id ?? null;
}

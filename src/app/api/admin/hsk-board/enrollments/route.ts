import { requireAdmin } from "@/lib/api-auth";
import { HSK_LEVELS } from "@/lib/hsk-levels";
import { normalizeEmail } from "@/lib/password";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = (await req.json()) as { email?: string; hskLevel?: string };
  const email = normalizeEmail(body.email ?? "");
  const hskLevel = body.hskLevel?.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
  }
  if (!hskLevel || !HSK_LEVELS.some((l) => l.id === hskLevel)) {
    return NextResponse.json({ error: "Cấp HSK không hợp lệ" }, { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, emailVerified: new Date() },
    });
  }

  const existing = await prisma.userHskLevel.findUnique({
    where: { userId_hskLevel: { userId: user.id, hskLevel } },
  });
  if (existing) {
    return NextResponse.json({ error: "Email đã có trong cấp này" }, { status: 409 });
  }

  const row = await prisma.userHskLevel.create({
    data: { userId: user.id, hskLevel },
    include: { user: { select: { email: true, name: true } } },
  });

  return NextResponse.json(row);
}

import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null };
}

export async function requireAdminOrEditor() {
  const session = await auth();
  if (!session?.user?.email) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const admin = isAdminEmail(session.user.email);
  const canEdit = session.user.canEditContent;
  if (!admin && !canEdit) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null, isAdmin: admin };
}

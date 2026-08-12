import { auth } from "@/auth";
import { getAccessStatus } from "@/lib/access";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await getAccessStatus(session.user.id);
  return NextResponse.json(status);
}

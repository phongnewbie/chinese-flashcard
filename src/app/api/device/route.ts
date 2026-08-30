import { auth } from "@/auth";
import { registerDevice } from "@/lib/devices";
import { resolveSessionUserId } from "@/lib/session-user";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveSessionUserId(session.user.id, session.user.email);
  if (!userId) {
    return NextResponse.json(
      { error: "session_invalid", message: "Vui lòng đăng xuất và đăng nhập lại." },
      { status: 401 },
    );
  }
  const body = (await req.json()) as {
    deviceKey?: string;
    label?: string;
  };

  if (!body.deviceKey || body.deviceKey.length < 8) {
    return NextResponse.json({ error: "deviceKey required" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") ?? undefined;
  const result = await registerDevice(
    userId,
    body.deviceKey,
    userAgent,
    body.label,
    session.user.email,
  );

  if (!result.ok) {
    return NextResponse.json(result, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}

import { auth } from "@/auth";
import { listCoursesForUser } from "@/lib/hsk-enrollment";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const courses = await listCoursesForUser(session.user.id, session.user.email);

  return NextResponse.json(courses);
}

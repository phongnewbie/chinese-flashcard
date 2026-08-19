import { requireAdmin } from "@/lib/api-auth";
import { getPersistenceInfo } from "@/lib/persistence";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  return NextResponse.json(getPersistenceInfo());
}

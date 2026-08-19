import { getPersistenceInfo } from "@/lib/persistence";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const persistence = getPersistenceInfo();
  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    persistence: {
      persistent: persistence.persistent,
      dbProvider: persistence.dbProvider,
      dbPath: persistence.dbPath,
      dbSizeBytes: persistence.dbSizeBytes,
    },
  });
}

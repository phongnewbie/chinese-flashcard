import { getAudioUploadDir, getImageUploadDir } from "@/lib/paths";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".webm": "audio/webm",
};

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_req: Request, context: RouteContext) {
  const segments = (await context.params).path;
  if (!segments?.length || segments.some((s) => s.includes(".."))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const roots = [getImageUploadDir(), getAudioUploadDir(), path.join(process.cwd(), "public", "uploads")];

  for (const root of roots) {
    const filePath = path.join(root, ...segments);
    if (!filePath.startsWith(root)) continue;
    try {
      const data = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const type = MIME[ext] ?? "application/octet-stream";
      return new NextResponse(data, {
        headers: {
          "Content-Type": type,
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {
      /* thử thư mục khác */
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

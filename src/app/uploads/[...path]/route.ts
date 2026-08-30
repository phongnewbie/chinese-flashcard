import { getAudioUploadDir, getImageUploadDir, getUploadRoot } from "@/lib/paths";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
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

function resolveUploadFile(segments: string[]): string | null {
  if (!segments.length || segments.some((s) => s.includes(".."))) return null;

  const [kind, ...rest] = segments;
  if (kind === "images" && rest.length > 0) {
    return path.join(/* turbopackIgnore: true */ getImageUploadDir(), ...rest.map(decodeURIComponent));
  }
  if (kind === "audio" && rest.length > 0) {
    return path.join(/* turbopackIgnore: true */ getAudioUploadDir(), ...rest.map(decodeURIComponent));
  }

  // Legacy: /uploads/images/foo.png tried against upload root directly
  return path.join(/* turbopackIgnore: true */ getUploadRoot(), ...segments.map(decodeURIComponent));
}

export async function GET(_req: Request, context: RouteContext) {
  const segments = (await context.params).path;
  const filePath = resolveUploadFile(segments);
  if (!filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowedRoots = [getUploadRoot(), getImageUploadDir(), getAudioUploadDir()];
  const allowed = allowedRoots.some((root) => {
    const normalized = path.normalize(filePath);
    return normalized === root || normalized.startsWith(root + path.sep);
  });
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
    const publicPath = path.join(
      /* turbopackIgnore: true */ process.cwd(),
      "public",
      "uploads",
      ...segments.map(decodeURIComponent),
    );
    if (existsSync(publicPath)) {
      try {
        const data = await readFile(publicPath);
        const ext = path.extname(publicPath).toLowerCase();
        const type = MIME[ext] ?? "application/octet-stream";
        return new NextResponse(data, {
          headers: {
            "Content-Type": type,
            "Cache-Control": "public, max-age=86400",
          },
        });
      } catch {
        /* fall through */
      }
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

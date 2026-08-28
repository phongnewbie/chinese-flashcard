import { requireAdmin } from "@/lib/api-auth";
import { toSoundTag } from "@/lib/anki-sound";
import { getAudioUploadDir, uploadUrl } from "@/lib/paths";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const ALLOWED = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm"]);

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  if (file.type && !ALLOWED.has(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a|webm)$/i)) {
    return NextResponse.json({ error: "Định dạng âm thanh không hỗ trợ" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^\w.\-()+\u4e00-\u9fff]/g, "_");
  const dir = getAudioUploadDir();
  await mkdir(dir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, safeName), bytes);

  const url = uploadUrl(`audio/${encodeURIComponent(safeName)}`);
  return NextResponse.json({ url, fileName: safeName, soundTag: toSoundTag(safeName) });
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const { readdir } = await import("fs/promises");
  const dir = getAudioUploadDir();
  await mkdir(dir, { recursive: true });
  const files = await readdir(dir);
  return NextResponse.json(
    files.map((f) => ({
      name: f,
      url: uploadUrl(`audio/${encodeURIComponent(f)}`),
      soundTag: toSoundTag(f),
    })),
  );
}

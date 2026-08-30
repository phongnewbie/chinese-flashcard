import { requireAdmin } from "@/lib/api-auth";
import { getImageUploadDir, uploadUrl } from "@/lib/paths";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  if (
    file.type &&
    !ALLOWED.has(file.type) &&
    !file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
  ) {
    return NextResponse.json({ error: "Định dạng ảnh không hỗ trợ" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^\w.\-()+\u4e00-\u9fff]/g, "_");
  const dir = getImageUploadDir();
  await mkdir(dir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(/* turbopackIgnore: true */ dir, safeName), bytes);

  const url = uploadUrl(`images/${encodeURIComponent(safeName)}`);
  return NextResponse.json({ url, fileName: safeName });
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const { readdir } = await import("fs/promises");
  const dir = getImageUploadDir();
  await mkdir(dir, { recursive: true });
  const files = await readdir(dir);
  return NextResponse.json(
    files.map((f) => ({ name: f, url: uploadUrl(`images/${encodeURIComponent(f)}`) })),
  );
}

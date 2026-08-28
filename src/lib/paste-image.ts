/** Trường ẢNH kiểu Anki — paste / hiển thị inline trong ô */

export type ImageAlign = "left" | "center" | "right" | "full";

export type UploadedImage = { url: string; fileName: string };

export function clipboardImageFile(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of data.items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

export async function uploadImageFile(file: File): Promise<UploadedImage> {
  const fd = new FormData();
  fd.set("file", file, file.name || `paste-${Date.now()}.png`);
  const res = await fetch("/api/admin/images", { method: "POST", body: fd });
  const data = (await res.json()) as { url?: string; fileName?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error ?? "Upload ảnh thất bại");
  }
  return { url: data.url, fileName: data.fileName ?? file.name };
}

export function resolveImageSrc(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const fromTag = trimmed.match(/<img\b[^>]*\ssrc=["']([^"']+)["']/i);
  const src = fromTag?.[1] ?? trimmed;
  if (/^https?:\/\//i.test(src) || src.startsWith("/")) return src;
  const name = src.replace(/^.*[\\/]/, "");
  return `/uploads/images/${encodeURIComponent(name)}`;
}

export function isImageFieldLabel(label: string): boolean {
  const norm = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
  return norm === "anh" || norm === "image" || norm === "hinh anh" || norm === "photo";
}

export function isImageOnlyFieldValue(value: string): boolean {
  const t = value.trim();
  if (!t || !extractImageSrcFromField(t)) return false;
  const textOnly = t.replace(/<[^>]*>/g, "").replace(/\s/g, "");
  return textOnly === "";
}

/** Chỉ trường ẺNH riêng — không dùng cho GHI CHÚ / VÍ DỤ */
export function fieldUsesImageEditor(label: string, _value: string, isImage?: boolean): boolean {
  return !!isImage || isImageFieldLabel(label);
}

export function extractImageSrcFromField(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const src = resolveImageSrc(trimmed);
  if (!src) return null;
  if (/<img\b/i.test(trimmed) || /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(trimmed)) {
    return src;
  }
  return null;
}

export function parseImageAlign(value: string): ImageAlign {
  if (/align-full|max-width:\s*100%/i.test(value)) return "full";
  if (/text-align:\s*right/i.test(value)) return "right";
  if (/text-align:\s*left/i.test(value)) return "left";
  return "center";
}

export function imageFieldHtml(url: string, align: ImageAlign = "center"): string {
  const safe = url.replace(/"/g, "");
  if (align === "full") {
    return `<div class="field-img-wrap align-full"><img src="${safe}" alt="" class="field-img" style="max-width:100%;height:auto;" /></div>`;
  }
  return `<div class="field-img-wrap align-${align}" style="text-align:${align};"><img src="${safe}" alt="" class="field-img" style="max-width:280px;height:auto;" /></div>`;
}

export function applyImageAlign(value: string, align: ImageAlign): string {
  const src = extractImageSrcFromField(value);
  if (!src) return value;
  return imageFieldHtml(src, align);
}

/** Chèn ảnh vào giá trị trường (Anki-style) */
export function applyImageToFieldValue(
  current: string,
  upload: UploadedImage,
  opts: { isImageField: boolean; multiline: boolean },
  selection?: { start: number; end: number },
): string {
  const { url } = upload;
  if (opts.isImageField) {
    return imageFieldHtml(url, "center");
  }
  if (opts.multiline) {
    const tag = `<img src="${url.replace(/"/g, "")}" alt="" class="field-img" />`;
    const start = selection?.start ?? current.length;
    const end = selection?.end ?? current.length;
    const prefix = current.slice(0, start);
    const suffix = current.slice(end);
    const join = prefix && !prefix.endsWith("\n") ? "\n" : "";
    return `${prefix}${join}${tag}${suffix}`;
  }
  return imageFieldHtml(url, "center");
}

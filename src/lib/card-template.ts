import { parseExtraFields } from "@/lib/fields";
import { resolveAudioUrl } from "@/lib/import-cards";
import { parseSoundFilename, renderTextWithSound, resolveSoundPlayUrl } from "@/lib/anki-sound";
import { resolveImageSrc } from "@/lib/paste-image";
import { resolveCourseTemplates, type SectionTemplatesMap } from "@/lib/section-templates";

export type TemplateFields = Record<string, string>;

export const DEFAULT_FRONT_TEMPLATE = `<div class="card front">
  <div class="hanzi">{{Front}}</div>
  {{#Pinyin}}<div class="pinyin">{{Pinyin}}</div>{{/Pinyin}}
  <p class="hint">Nhấn Space để lật thẻ</p>
</div>`;

export const DEFAULT_BACK_TEMPLATE = `<div class="card back">
  <div class="meaning">{{Back}}</div>
  {{#Pinyin}}<div class="pinyin">{{Pinyin}}</div>{{/Pinyin}}
  <div class="hanzi-ref">{{Front}}</div>
  {{#Audio}}{{Audio}}{{/Audio}}
  {{#Ví dụ}}<div class="example"><strong>Ví dụ:</strong> {{Ví dụ}}</div>{{/Ví dụ}}
  {{#Ghi chú}}<div class="note">{{Ghi chú}}</div>{{/Ghi chú}}
</div>`;

export const DEFAULT_CARD_CSS = `.card {
  text-align: center;
  padding: 1.5rem;
}
.hanzi, .hanzi-ref {
  font-size: 2.5rem;
  font-weight: 600;
  color: #1c1917;
}
.meaning {
  font-size: 1.5rem;
  color: #047857;
  font-weight: 600;
}
.pinyin {
  font-size: 1.125rem;
  color: #78716c;
  margin-top: 0.5rem;
}
.hint {
  font-size: 0.75rem;
  color: #a8a29e;
  margin-top: 2rem;
}
.hanzi-ref {
  font-size: 1.75rem;
  margin-top: 1rem;
  opacity: 0.85;
}
.example, .note {
  font-size: 0.95rem;
  color: #57534e;
  margin-top: 1rem;
  text-align: left;
}`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isAudioValue(val: string): boolean {
  return /\.(mp3|wav|ogg|m4a|webm)(\?|$)/i.test(val) || val.startsWith("/uploads/audio");
}

function isImageFieldKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k === "ảnh" ||
    k === "image" ||
    k.includes("hình ảnh") ||
    k.includes("hinh anh") ||
    (k.includes("anh") && !k.includes("thanh") && !k.includes("han"))
  );
}

function isImageFilename(val: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(val) && !/<img/i.test(val);
}

/** Chỉ giữ thẻ img trỏ uploads hoặc https */
function sanitizeEmbeddedImages(html: string): string {
  let out = html.replace(
    /<div\b[^>]*class=["'][^"']*field-img-wrap[^"']*["'][^>]*style=["']text-align:([^"']+)["'][^>]*>([\s\S]*?)<\/div>/gi,
    (_full, align: string, inner: string) => {
      const img = inner.match(/<img\b[^>]*\ssrc=["']([^"']+)["']/i);
      if (!img?.[1] || !/^(\/uploads\/images\/|https?:\/\/)/i.test(img[1].trim())) return "";
      return `<div class="field-img-wrap" style="text-align:${escapeHtml(align.trim())}">${sanitizeEmbeddedImages(inner)}</div>`;
    },
  );
  out = out.replace(/<img\b[^>]*\ssrc=["']([^"']+)["'][^>]*\/?>/gi, (_full, src: string) => {
    if (!/^(\/uploads\/images\/|https?:\/\/)/i.test(src.trim())) return "";
    return `<img src="${escapeHtml(src.trim())}" alt="" class="field-img" style="max-width:100%;height:auto;" />`;
  });
  return out;
}

function fieldToHtml(key: string, val: string, side: "front" | "back"): string {
  if (!val) return "";
  const k = key.toLowerCase();

  const soundOnly = parseSoundFilename(val.trim());
  if (soundOnly && val.trim().match(/^\[sound:[^\]]+\]$/i)) {
    const url = resolveSoundPlayUrl(soundOnly);
    return `<button type="button" class="audio-btn" data-audio="${escapeHtml(url)}" title="Nghe">🔊 Nghe</button>`;
  }

  if (k === "audio" || k === "âm thanh" || k === "am thanh") {
    if (isAudioValue(val)) {
      const url = resolveSoundPlayUrl(val);
      return `<button type="button" class="audio-btn" data-audio="${escapeHtml(url)}" title="Nghe">🔊 Nghe</button>`;
    }
    if (/\[sound:/i.test(val)) return renderTextWithSound(val);
    return escapeHtml(val);
  }
  if (isAudioValue(val) && (k.includes("audio") || k.includes("am thanh"))) {
    const url = resolveSoundPlayUrl(val);
    return `<button type="button" class="audio-btn" data-audio="${escapeHtml(url)}" title="Nghe">🔊 Nghe</button>`;
  }
  if (/<img\b/i.test(val) || /field-img-wrap/i.test(val)) {
    return sanitizeEmbeddedImages(val);
  }
  if (/\[sound:/i.test(val)) {
    return renderTextWithSound(val);
  }
  if (isImageFieldKey(k) && isImageFilename(val)) {
    const src = escapeHtml(resolveImageSrc(val));
    return `<img src="${src}" alt="" class="field-img" style="max-width:100%;height:auto;" />`;
  }
  return escapeHtml(val);
}

/** Thay {{Front}}, {{#Trường}}...{{/Trường}} — hỗ trợ trường tùy chỉnh Anki */
export function renderCardTemplate(
  template: string,
  fields: TemplateFields,
  side: "front" | "back",
): string {
  let html = template;

  const blockRe = /\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  html = html.replace(blockRe, (_, key: string, inner: string) => {
    const val = fields[key.trim()];
    return val?.trim() ? inner : "";
  });

  for (const [key, val] of Object.entries(fields)) {
    const rendered = fieldToHtml(key, val, side);
    html = html.replaceAll(`{{${key}}}`, rendered);
  }

  html = html.replace(/\{\{[^}]+\}\}/g, "");
  return html;
}

export function getCourseTemplates(
  course: {
    frontTemplate: string | null;
    backTemplate: string | null;
    cardCss: string | null;
    primarySection?: string | null;
  },
  globalSectionTemplates?: SectionTemplatesMap | null,
) {
  return resolveCourseTemplates(course, globalSectionTemplates);
}

export function toCardFields(card: {
  front: string;
  back: string;
  pinyin: string | null;
  audioUrl: string | null;
  section?: string;
  extraFields?: string | null;
}): TemplateFields {
  const extras = parseExtraFields(card.extraFields);
  const vocabExtras = {
    "Nghĩa hán việt": extras["Nghĩa hán việt"] ?? extras["HÁN VIỆT"] ?? "",
    "Loại từ": extras["Loại từ"] ?? extras["LOẠI TỪ"] ?? "",
    "Đặt câu": extras["Đặt câu"] ?? extras["ĐẶT CÂU"] ?? extras["VÍ DỤ"] ?? "",
  };
  return {
    Front: card.front,
    Back: card.back,
    Pinyin: card.pinyin ?? "",
    Audio: resolveAudioUrl(card.audioUrl ?? undefined, "/uploads/audio") ?? "",
    Section: card.section ?? "",
    "Tiếng Trung": card.front,
    "Nghĩa tiếng Việt": card.back,
    ...extras,
    ...vocabExtras,
  };
}

import { parseExtraFields } from "@/lib/fields";
import { resolveSoundPlayUrl, isPlayableAudio, renderTextWithSound } from "@/lib/anki-sound";
import type { CardTypeDef } from "@/lib/card-types";
import { requiredFieldLabels } from "@/lib/section-presets";
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

function isImageFieldKey(key: string): boolean {
  const k = key.toLowerCase().trim();
  return (
    k === "ảnh" ||
    k === "anh" ||
    k === "image" ||
    k === "photo" ||
    k === "picture" ||
    k === "hình ảnh" ||
    k === "hinh anh" ||
    k === "ảnh thẻ"
  );
}

function isImageFilename(val: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(val) && !/<img/i.test(val);
}

/** Giữ thẻ img an toàn */
function sanitizeEmbeddedImages(html: string): string {
  let out = html.replace(
    /<div\b[^>]*class=["'][^"']*field-img-wrap[^"']*["'][^>]*style=["']text-align:([^"']+)["'][^>]*>([\s\S]*?)<\/div>/gi,
    (_full, align: string, inner: string) => {
      const img = inner.match(/<img\b[^>]*\ssrc=["']([^"']+)["']/i);
      if (!img?.[1] || !/^(\/|https?:\/\/|data:)/i.test(img[1].trim())) return "";
      return `<div class="field-img-wrap align-${escapeHtml(align.trim())}" style="text-align:${escapeHtml(align.trim())}">${sanitizeEmbeddedImages(inner)}</div>`;
    },
  );
  out = out.replace(/<img\b[^>]*\ssrc=["']([^"']+)["'][^>]*\/?>/gi, (_full, src: string) => {
    if (!/^(\/|https?:\/\/|data:)/i.test(src.trim())) return "";
    return `<img src="${escapeHtml(src.trim())}" alt="" class="field-img" />`;
  });
  return out;
}

function isAudioFieldKey(key: string): boolean {
  const k = key.toLowerCase();
  return k === "audio" || k === "âm thanh" || k === "am thanh" || k.includes("am thanh");
}

function fieldToHtml(key: string, val: string, side: "front" | "back", fieldsContext?: TemplateFields): string {
  if (!val) return "";
  const k = key.toLowerCase();
  const trimmed = val.trim();
  const chineseText =
    fieldsContext?.["Tiếng Trung"] ||
    fieldsContext?.["CẤU TRÚC"] ||
    fieldsContext?.["Front"] ||
    fieldsContext?.["CÂU ĐÚNG"] ||
    "";

  if (isAudioFieldKey(k) || isPlayableAudio(trimmed)) {
    if (isPlayableAudio(trimmed)) {
      const url = resolveSoundPlayUrl(trimmed);
      const textAttr = chineseText ? ` data-text="${escapeHtml(chineseText)}"` : "";
      return `<button type="button" class="audio-btn" data-audio="${escapeHtml(url)}"${textAttr} title="Nghe">🔊 Nghe</button>`;
    }
    if (/\[sound:/i.test(val) || /https?:\/\//i.test(val)) return renderTextWithSound(val);
  }

  if (/<img\b/i.test(val) || /field-img-wrap/i.test(val)) {
    return sanitizeEmbeddedImages(val);
  }
  if (/\[sound:/i.test(val) || /https?:\/\//i.test(val)) {
    return renderTextWithSound(val);
  }
  if (isImageFieldKey(k) || isImageFilename(trimmed)) {
    const src = escapeHtml(resolveImageSrc(trimmed));
    return `<div class="card-image"><img src="${src}" alt="" class="field-img" /></div>`;
  }
  return escapeHtml(val);
}

function appendMissingAudioFields(html: string, fields: TemplateFields, side: "front" | "back"): string {
  if (/data-audio|audio-btn/i.test(html)) return html;
  for (const [key, val] of Object.entries(fields)) {
    if (!val?.trim()) continue;
    if (!isPlayableAudio(val.trim()) && !/\[sound:/i.test(val)) continue;
    const rendered = fieldToHtml(key, val, side, fields);
    if (rendered.includes("data-audio")) {
      return `${html}<div class="card-audio">${rendered}</div>`;
    }
  }
  return html;
}

function appendMissingImageFields(html: string, fields: TemplateFields, side: "front" | "back"): string {
  if (/field-img|card-image/i.test(html)) return html;
  const blocks: string[] = [];
  for (const [key, val] of Object.entries(fields)) {
    if (!val?.trim()) continue;
    if (!isImageFieldKey(key) && !/<img\b/i.test(val) && !isImageFilename(val.trim())) continue;
    const rendered = fieldToHtml(key, val, side, fields);
    if (rendered && (rendered.includes("field-img") || rendered.includes("<img"))) {
      blocks.push(rendered.includes("card-image") ? rendered : `<div class="card-image">${rendered}</div>`);
    }
  }
  if (!blocks.length) return html;
  return `${html}${blocks.join("")}`;
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
    const rendered = fieldToHtml(key, val, side, fields);
    html = html.replaceAll(`{{${key}}}`, rendered);
  }

  html = html.replace(/\{\{[^}]+\}\}/g, "");
  html = appendMissingImageFields(html, fields, side);
  return appendMissingAudioFields(html, fields, side);
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

export function resolveCardTypeTemplates(
  base: { frontTemplate: string; backTemplate: string; cardCss: string },
  _cardType?: CardTypeDef | null,
) {
  return base;
}

export function applyCardTypeLayout(
  fields: TemplateFields,
  card: { front: string; back: string; pinyin: string | null; section?: string },
  cardType?: CardTypeDef | null,
): TemplateFields {
  const layout = cardType?.layout ?? "default";
  if (layout === "custom" || layout === "default" || layout === "viet_trung") return fields;

  const section = card.section ?? "vocabulary";
  const { front: frontLabel, back: backLabel } = requiredFieldLabels(section);

  if (layout === "trung_viet") {
    const next: TemplateFields = {
      ...fields,
      Front: card.back,
      Back: card.front,
    };
    if (section === "vocabulary") {
      next["Nghĩa tiếng Việt"] = card.front;
      next["Tiếng Trung"] = card.back;
    } else {
      next[frontLabel] = card.front;
      next[backLabel] = card.back;
    }
    return next;
  }

  if (layout === "pinyin_trung") {
    const p = card.pinyin?.trim() || card.back;
    const next: TemplateFields = { ...fields, Pinyin: card.pinyin ?? "" };
    if (section === "vocabulary") {
      next["Nghĩa tiếng Việt"] = p;
      next["Tiếng Trung"] = card.front;
      next.Front = card.front;
      next.Back = card.back;
    } else {
      next.Front = p;
      next.Back = card.front;
      next[frontLabel] = p;
      next[backLabel] = card.front;
    }
    return next;
  }

  return fields;
}

export function toCardFields(
  card: {
    front: string;
    back: string;
    pinyin: string | null;
    audioUrl: string | null;
    section?: string;
    extraFields?: string | null;
  },
  cardType?: CardTypeDef | null,
): TemplateFields {
  const extras = parseExtraFields(card.extraFields);
  const audioRaw =
    card.audioUrl?.trim() ||
    extras["ÂM THANH"]?.trim() ||
    extras["Âm thanh"]?.trim() ||
    extras["Audio"]?.trim() ||
    "";
  const audioResolved = audioRaw ? resolveSoundPlayUrl(audioRaw) : "";
  const vocabExtras = {
    "Nghĩa hán việt": extras["Nghĩa hán việt"] ?? extras["HÁN VIỆT"] ?? "",
    "Loại từ": extras["Loại từ"] ?? extras["LOẠI TỪ"] ?? "",
    "Đặt câu": extras["Đặt câu"] ?? extras["ĐẶT CÂU"] ?? extras["VÍ DỤ"] ?? "",
  };
  const rawImage =
    extras["ẢNH"] ??
    extras["Ảnh"] ??
    extras["ảnh"] ??
    extras["HÌNH ẢNH"] ??
    extras["Hình ảnh"] ??
    extras["hinh anh"] ??
    extras["IMAGE"] ??
    extras["Image"] ??
    extras["image"] ??
    extras["Photo"] ??
    extras["PHOTO"] ??
    "";
  const base: TemplateFields = {
    Front: card.front,
    Back: card.back,
    Pinyin: card.pinyin ?? "",
    PINYIN: card.pinyin ?? "",
    Audio: audioResolved,
    "ÂM THANH": audioResolved,
    Section: card.section ?? "",
    "Tiếng Trung": card.front,
    "Nghĩa tiếng Việt": card.back,
    "CHỮ HÁN": card.front,
    "NGHĨA TIẾNG VIỆT": card.back,
    "CẤU TRÚC": extras["CẤU TRÚC"] ?? extras["VÍ DỤ"] ?? "",
    "CÁCH DÙNG": extras["CÁCH DÙNG"] ?? extras["GHI CHÚ"] ?? "",
    "ĐIỂM NGỮ PHÁP": extras["ĐIỂM NGỮ PHÁP"] ?? "",
    MÃ: extras["MÃ"] ?? "",
    "GIẢI THÍCH": extras["GIẢI THÍCH"] ?? card.back,
    "TÌNH HUỐNG": card.front,
    "CÂU TRẢ LỜI": card.back,
    "MẢNH CÂU": card.front,
    "CÂU ĐÚNG": card.back,
    ẢNH: rawImage,
    Ảnh: rawImage,
    ảnh: rawImage,
    "Hình ảnh": rawImage,
    "HÌNH ẢNH": rawImage,
    "hinh anh": rawImage,
    Image: rawImage,
    IMAGE: rawImage,
    image: rawImage,
    Photo: rawImage,
    PHOTO: rawImage,
    ...extras,
    ...vocabExtras,
  };
  return applyCardTypeLayout(base, card, cardType);
}

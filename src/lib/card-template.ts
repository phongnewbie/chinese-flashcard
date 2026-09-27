import { parseExtraFields } from "@/lib/fields";
import { resolveSoundPlayUrl, isPlayableAudio, renderTextWithSound, firstAudioInText } from "@/lib/anki-sound";
import { parseExample } from "@/lib/hsk-card";
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
  padding: 1rem 1.25rem;
  width: 100%;
  min-height: 100%;
  margin: auto 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
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

function isSafeImageSrc(src: string): boolean {
  const s = src.trim();
  return /^(https?:\/\/|\/\/|\/|data:|uploads\/)/i.test(s);
}

function looksLikeImageValue(val: string): boolean {
  const t = val.trim();
  if (!t) return false;
  if (/<img\b/i.test(t) || /field-img-wrap/i.test(t)) return true;
  if (isImageFilename(t)) return true;
  if (/^\/uploads\/images\//i.test(t)) return true;
  return false;
}

/** Giữ thẻ img an toàn */
function sanitizeEmbeddedImages(html: string): string {
  let out = html.replace(
    /<div\b[^>]*class=["'][^"']*field-img-wrap[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    (_full, inner: string) => {
      const imgs = sanitizeEmbeddedImages(inner);
      if (!imgs.includes("<img")) return "";
      return `<div class="field-img-wrap">${imgs}</div>`;
    },
  );
  out = out.replace(/<img\b[^>]*>/gi, (full) => {
    const srcMatch = full.match(/\ssrc=["']([^"']+)["']/i);
    const src = srcMatch?.[1]?.trim() ?? "";
    if (!src) return "";
    const resolved = /^(\/|https?:\/\/|data:)/i.test(src) ? src : resolveImageSrc(src);
    if (!isSafeImageSrc(resolved) && !isSafeImageSrc(src)) return "";
    const finalSrc = isSafeImageSrc(src) ? src : resolved;
    return `<img src="${escapeHtml(finalSrc)}" alt="" class="field-img" />`;
  });
  return out;
}

function isAudioFieldKey(key: string): boolean {
  const k = key.toLowerCase();
  return k === "audio" || k === "âm thanh" || k === "am thanh" || k.includes("am thanh");
}

function isExampleFieldKey(key: string): boolean {
  const k = key
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
  return k.includes("dat cau") || k === "vi du" || k === "example" || k === "vd";
}

function exampleFieldHtml(val: string): string {
  if (/\[sound:/i.test(val) || /<img\b/i.test(val) || /field-img-wrap/i.test(val)) {
    const withImg = /<img\b/i.test(val) ? sanitizeEmbeddedImages(val) : val;
    return renderTextWithSound(withImg);
  }
  const plain = val.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
  const parsed = parseExample(plain);
  if (!parsed) return escapeHtml(val);
  const audioSrc = firstAudioInText(val);
  const btn =
    parsed.chinese || audioSrc
      ? `<button type="button" class="audio-btn" data-audio="${escapeHtml(
          audioSrc ? resolveSoundPlayUrl(audioSrc) : "",
        )}" data-text="${escapeHtml(parsed.chinese)}" title="Nghe câu ví dụ">🔊</button>`
      : "";
  const parts: string[] = [];
  if (parsed.chinese) parts.push(`<span class="example-cn">${escapeHtml(parsed.chinese)}</span>`);
  if (parsed.pinyin) parts.push(`<span class="example-py">${escapeHtml(parsed.pinyin)}</span>`);
  if (parsed.vietnamese) parts.push(`<span class="example-vi">${escapeHtml(parsed.vietnamese)}</span>`);
  return `${parts.join(' <span class="example-sep">/</span> ')} ${btn}`.trim();
}

function sentencePiecesHtml(val: string): string {
  const raw = val.replace(/<[^>]+>/g, " ").trim();
  const parts = raw.includes("|")
    ? raw.split("|")
    : raw.includes("/")
      ? raw.split("/")
      : raw.split(/\s+/);
  const chips = parts
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => `<span class="so-chip">${escapeHtml(p)}</span>`)
    .join("");
  return `<div class="so-chips">${chips}</div>`;
}

function isPiecesFieldKey(key: string): boolean {
  const k = key.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  return k.includes("manh cau") || k === "front";
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

  if (looksLikeImageValue(trimmed) || isImageFieldKey(k)) {
    if (/<img\b/i.test(val) || /field-img-wrap/i.test(val)) {
      return sanitizeEmbeddedImages(val);
    }
    const src = escapeHtml(resolveImageSrc(trimmed));
    if (src) return `<div class="card-image"><img src="${src}" alt="" class="field-img" /></div>`;
  }

  if (isAudioFieldKey(k) || isPlayableAudio(trimmed)) {
    if (isPlayableAudio(trimmed)) {
      const url = resolveSoundPlayUrl(trimmed);
      const textAttr = chineseText ? ` data-text="${escapeHtml(chineseText)}"` : "";
      return `<button type="button" class="audio-btn" data-audio="${escapeHtml(url)}"${textAttr} title="Nghe">🔊 Nghe</button>`;
    }
    if (/\[sound:/i.test(val) || /https?:\/\//i.test(val)) return renderTextWithSound(val);
  }

  if (isExampleFieldKey(key)) {
    return exampleFieldHtml(val);
  }
  if (fieldsContext?.Section === "sentence_order" && isPiecesFieldKey(key) && side === "front") {
    return sentencePiecesHtml(val);
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
  if (/<img\b/i.test(html)) return html;
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

  html = html.replace(/\{\{\s*(GÕ CHỮ|GO CHU|INPUT|TYPE INPUT)\s*\}\}/gi, "<!--__STUDY_INPUT__-->");
  html = html.replace(/\{\{\s*(GỢI Ý|GOI Y|HINT)\s*\}\}/gi, "<!--__STUDY_HINT__-->");
  html = html.replace(/\{\{\s*(GHÉP CÂU|GHEP CAU|PIECES)\s*\}\}/gi, "<!--__STUDY_PIECES__-->");
  html = html.replace(/\{\{\s*(Ô ĐÁP ÁN|O DAP AN|ANSWER BOX)\s*\}\}/gi, "<!--__STUDY_ANSWER_BOX__-->");

  html = html.replace(/\{\{[^}]+\}\}/g, "");
  html = appendMissingImageFields(html, fields, side);
  return appendMissingAudioFields(html, fields, side);
}

export function fillStudyMarkersForPreview(html: string): string {
  return html
    .replaceAll(
      "<!--__STUDY_INPUT__-->",
      `<input class="hsk-input" style="width:100%;max-width:22rem;margin:0.75rem auto;display:block;padding:0.65rem 1rem;border-radius:0.75rem;border:2px solid #e5e5e5;text-align:center" placeholder="Gõ chữ Hán..." disabled />`,
    )
    .replaceAll(
      "<!--__STUDY_HINT__-->",
      `<div style="text-align:center;margin:0.5rem 0"><span style="display:inline-block;border-radius:9999px;border:1px solid #6ee7b7;background:#ecfdf5;padding:0.25rem 0.9rem;font-size:0.875rem;color:#065f46">💡 Gợi ý</span></div>`,
    )
    .replaceAll(
      "<!--__STUDY_ANSWER_BOX__-->",
      `<div class="so-drop">Câu của bạn sẽ hiện ở đây…</div>`,
    )
    .replaceAll(
      "<!--__STUDY_PIECES__-->",
      `<div class="so-chips"><span class="so-chip">我</span><span class="so-chip">喜欢</span><span class="so-chip">学习</span><span class="so-chip">中文</span></div>`,
    );
}

export function getCourseTemplates(
  course: {
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
    audioUrl?: string | null;
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

import { parseExtraFields } from "@/lib/fields";

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

function fieldToHtml(key: string, val: string, side: "front" | "back"): string {
  if (!val) return "";
  const k = key.toLowerCase();
  if (k === "audio" || k === "âm thanh" || k === "am thanh") {
    return side === "back" && isAudioValue(val)
      ? `<button type="button" class="audio-btn" data-audio="${escapeHtml(val)}">🔊 Nghe</button>`
      : escapeHtml(val);
  }
  if (isAudioValue(val) && (k.includes("audio") || k.includes("am thanh"))) {
    return side === "back"
      ? `<button type="button" class="audio-btn" data-audio="${escapeHtml(val)}">🔊 Nghe</button>`
      : escapeHtml(val);
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

export function getCourseTemplates(course: {
  frontTemplate: string | null;
  backTemplate: string | null;
  cardCss: string | null;
}) {
  return {
    frontTemplate: course.frontTemplate?.trim() || DEFAULT_FRONT_TEMPLATE,
    backTemplate: course.backTemplate?.trim() || DEFAULT_BACK_TEMPLATE,
    cardCss: course.cardCss?.trim() || DEFAULT_CARD_CSS,
  };
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
  return {
    Front: card.front,
    Back: card.back,
    Pinyin: card.pinyin ?? "",
    Audio: card.audioUrl ?? "",
    Section: card.section ?? "",
    ...extras,
  };
}

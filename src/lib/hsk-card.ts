import { parseExtraFields } from "@/lib/fields";
import { firstAudioInText, resolveSoundPlayUrl } from "@/lib/anki-sound";
import { normHeader } from "@/lib/import-cards";

export type HskCardView = {
  id: string;
  answer: string;
  hints: string;
  prompt: string;
  pinyin: string;
  imageUrl: string;
  hskLevel: string;
  audioUrl: string;
  example: ExampleBlock | null;
  mnemonic: string;
  exampleAudioUrl: string;
  cardType: string;
  cardTypeLabel: string;
  srs: {
    isNew?: boolean;
    intervalDays?: number;
    learningStep?: number;
  };
};

export type ExampleBlock = {
  chinese: string;
  pinyin: string;
  vietnamese: string;
};

const LEVEL_KEYS = ["hsk", "cap do", "cấp độ", "level", "cap"];
const IMAGE_KEYS = ["anh", "hinh anh", "hình ảnh", "image", "photo", "picture", "anh the", "ảnh thẻ", "card image"];
const EXAMPLE_KEYS = ["vi du", "ví dụ", "example", "cau vi du", "câu ví dụ", "vd", "cau mau", "câu mẫu", "dat cau", "đặt câu"];
const MNEMONIC_KEYS = [
  "cach nho", "cách nhớ", "mnemonic", "bo thu", "bộ thủ", "etymology",
  "giai thich tu", "giải thích từ", "cach ghi nho", "cach ghi nhớ", "ghi nho", "ghi nhớ",
];
const EXAMPLE_AUDIO_KEYS = ["am thanh vi du", "âm thanh ví dụ", "example audio", "audio vi du"];
const AUDIO_KEYS = ["am thanh", "âm thanh", "audio", "mp3"];

function pickExtra(extras: Record<string, string>, keys: string[]): string {
  for (const [rawKey, val] of Object.entries(extras)) {
    if (!val?.trim()) continue;
    const nk = normHeader(rawKey);
    // Exact or safe match, ignore 'tieng anh' / 'anh van' for image keys
    if (keys.some((k) => nk === k || (k.length >= 6 && nk.includes(k)))) return val;
  }
  return "";
}

export function parseExample(text: string): ExampleBlock | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const slashMatch = trimmed.match(/^(.+?)\s*\/([^/]+)\/\s*([\s\S]*)$/);
  if (slashMatch) {
    return {
      chinese: slashMatch[1].trim(),
      pinyin: slashMatch[2].trim(),
      vietnamese: slashMatch[3].trim(),
    };
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 3) {
    return { chinese: lines[0], pinyin: lines[1], vietnamese: lines.slice(2).join(" ") };
  }
  if (lines.length === 2) {
    return { chinese: lines[0], pinyin: "", vietnamese: lines[1] };
  }
  return { chinese: trimmed, pinyin: "", vietnamese: "" };
}

export function hanziiSearchUrl(character: string): string {
  const q = encodeURIComponent(character.trim().charAt(0) || character);
  return `https://hanzii.net/vi/search?q=${q}`;
}

export function extractImageUrl(value: string | undefined): string {
  if (!value || !value.trim()) return "";
  const trimmed = value.trim();
  // 1. Tag <img src="...">
  const imgMatch = trimmed.match(/<img\b[^>]*\ssrc=["']([^"']+)["']/i);
  if (imgMatch?.[1]) {
    const src = imgMatch[1].trim();
    if (/^(https?:\/\/|\/|data:)/i.test(src)) return src;
    const name = src.replace(/^.*[\\/]/, "");
    return `/uploads/images/${encodeURIComponent(name)}`;
  }
  // 2. URL hoặc đường dẫn trực tiếp
  if (/^(https?:\/\/|\/|data:)/i.test(trimmed)) {
    return trimmed;
  }
  // 3. Tên file ảnh
  if (/\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|#|$)/i.test(trimmed)) {
    const name = trimmed.replace(/^.*[\\/]/, "");
    return `/uploads/images/${encodeURIComponent(name)}`;
  }
  return "";
}

export function resolveMediaUrl(value: string | undefined, base: string): string {
  return extractImageUrl(value) || "";
}

export function toHskCardView(card: {
  id: string;
  front: string;
  back: string;
  pinyin: string | null;
  audioUrl: string | null;
  extraFields: string | null;
  cardType?: string;
  cardTypeLabel?: string;
  srs: { isNew?: boolean; intervalDays?: number; learningStep?: number };
}): HskCardView {
  const extras = parseExtraFields(card.extraFields);
  const level = pickExtra(extras, LEVEL_KEYS) || "HSK";
  
  let rawImage = pickExtra(extras, IMAGE_KEYS);
  let imageUrl = extractImageUrl(rawImage);
  if (!imageUrl) {
    for (const [k, val] of Object.entries(extras)) {
      if (val && (val.includes("<img") || /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|#|$)/i.test(val))) {
        const found = extractImageUrl(val);
        if (found) {
          imageUrl = found;
          break;
        }
      }
    }
  }
  if (!imageUrl) {
    imageUrl = extractImageUrl(card.front) || extractImageUrl(card.back);
  }

  const rawExample = pickExtra(extras, EXAMPLE_KEYS);
  const example = rawExample ? parseExample(rawExample) : null;
  const mnemonic = pickExtra(extras, MNEMONIC_KEYS);
  const rawExAudio =
    pickExtra(extras, EXAMPLE_AUDIO_KEYS) ||
    (rawExample ? firstAudioInText(rawExample) : "") ||
    "";
  const rawMainAudio = card.audioUrl?.trim() || pickExtra(extras, AUDIO_KEYS) || "";
  const exampleAudioUrl = rawExAudio ? resolveSoundPlayUrl(rawExAudio) : "";

  const cardType = card.cardType ?? "viet_trung";
  let prompt = card.back.trim();
  let answer = card.front.trim();
  if (cardType === "trung_viet") {
    prompt = card.front.trim();
    answer = card.back.trim();
  } else if (cardType === "card_3") {
    prompt = card.pinyin?.trim() || card.back.trim();
    answer = card.front.trim();
  }

  return {
    id: card.id,
    answer,
    hints: prompt,
    prompt,
    cardType,
    cardTypeLabel: card.cardTypeLabel ?? cardType,
    pinyin: card.pinyin?.trim() ?? "",
    imageUrl,
    hskLevel: level.toUpperCase().replace(/\s+/g, ""),
    audioUrl: rawMainAudio ? resolveSoundPlayUrl(rawMainAudio) : "",
    example,
    mnemonic,
    exampleAudioUrl,
    srs: card.srs,
  };
}

export function normalizeAnswer(s: string) {
  return s.replace(/\s+/g, "").toLowerCase();
}

export function answersMatch(typed: string, expected: string) {
  const a = normalizeAnswer(typed);
  const b = normalizeAnswer(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

export function formatHints(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\d+[.)]\s*/, ""));
}

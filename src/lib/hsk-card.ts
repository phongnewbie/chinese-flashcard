import { parseExtraFields } from "@/lib/fields";
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
const IMAGE_KEYS = ["hinh anh", "hình ảnh", "image", "anh", "photo", "picture"];
const EXAMPLE_KEYS = ["vi du", "ví dụ", "example", "cau vi du", "câu ví dụ", "vd", "cau mau", "câu mẫu"];
const MNEMONIC_KEYS = [
  "cach nho", "cách nhớ", "mnemonic", "bo thu", "bộ thủ", "etymology",
  "giai thich tu", "giải thích từ", "cach ghi nho", "cach ghi nhớ", "ghi nho", "ghi nhớ",
];
const EXAMPLE_AUDIO_KEYS = ["am thanh vi du", "âm thanh ví dụ", "example audio", "audio vi du"];

function pickExtra(extras: Record<string, string>, keys: string[]): string {
  for (const [rawKey, val] of Object.entries(extras)) {
    const nk = normHeader(rawKey);
    if (keys.some((h) => nk === h || nk.includes(h) || h.includes(nk))) return val;
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

export function resolveMediaUrl(value: string | undefined, base: string): string {
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  const name = value.replace(/^.*[\\/]/, "");
  return `${base}/${encodeURIComponent(name)}`;
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
  const rawImage = pickExtra(extras, IMAGE_KEYS);
  const imageUrl = resolveMediaUrl(rawImage, "/uploads/images");

  const rawExample = pickExtra(extras, EXAMPLE_KEYS);
  const example = rawExample ? parseExample(rawExample) : null;
  const mnemonic = pickExtra(extras, MNEMONIC_KEYS);
  const rawExAudio = pickExtra(extras, EXAMPLE_AUDIO_KEYS);
  const exampleAudioUrl = resolveMediaUrl(rawExAudio, "/uploads/audio");

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
    audioUrl: card.audioUrl ?? "",
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

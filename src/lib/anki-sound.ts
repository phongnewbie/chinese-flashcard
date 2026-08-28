import { resolveAudioUrl } from "@/lib/import-cards";

const SOUND_TAG_RE = /\[sound:([^\]]+)\]/gi;

/** Lấy tên file từ [sound:ten.mp3] */
export function parseSoundFilename(raw: string): string | null {
  const trimmed = raw.trim();
  const exact = trimmed.match(/^\[sound:([^\]]+)\]$/i);
  if (exact?.[1]) return exact[1].trim();
  const inline = trimmed.match(/\[sound:([^\]]+)\]/i);
  return inline?.[1]?.trim() ?? null;
}

export function toSoundTag(fileName: string): string {
  const name = fileName.replace(/^.*[\\/]/, "").trim();
  return `[sound:${name}]`;
}

export function resolveSoundPlayUrl(fileNameOrTag: string): string {
  const fromTag = parseSoundFilename(fileNameOrTag);
  const name = fromTag ?? fileNameOrTag.replace(/^.*[\\/]/, "").trim();
  return resolveAudioUrl(name, "/uploads/audio") ?? name;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Thay [sound:file.mp3] → nút 🔊 (Anki / HyperTTS) */
export function renderTextWithSound(text: string): string {
  if (!text || !/\[sound:/i.test(text)) {
    return escapeHtml(text);
  }
  let out = "";
  let last = 0;
  for (const m of text.matchAll(SOUND_TAG_RE)) {
    const idx = m.index ?? 0;
    out += escapeHtml(text.slice(last, idx));
    const url = resolveSoundPlayUrl(m[1]!);
    out += `<button type="button" class="audio-btn" data-audio="${escapeHtml(url)}" title="Nghe">🔊</button>`;
    last = idx + m[0].length;
  }
  out += escapeHtml(text.slice(last));
  return out.replace(/\n/g, "<br>");
}

export function firstSoundInText(text: string): string | null {
  const m = text.match(/\[sound:([^\]]+)\]/i);
  return m?.[1]?.trim() ?? null;
}

export function containsSoundTag(text: string): boolean {
  return /\[sound:/i.test(text);
}

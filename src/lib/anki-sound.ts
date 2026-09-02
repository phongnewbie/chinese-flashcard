import { resolveAudioUrl } from "@/lib/import-cards";

/** Lấy tên file từ [sound:ten.mp3] */
export function parseSoundFilename(raw: string): string | null {
  const trimmed = raw.trim();
  const exact = trimmed.match(/^\[sound:([^\]]+)\]$/i);
  if (exact?.[1]) return exact[1].trim();
  const inline = trimmed.match(/\[sound:([^\]]+)\]/i);
  return inline?.[1]?.trim() ?? null;
}

export function toSoundTag(fileName: string): string {
  const trimmed = fileName.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const name = trimmed.replace(/^.*[\\/]/, "").trim();
  return `[sound:${name}]`;
}

export function resolveSoundPlayUrl(fileNameOrTag: string): string {
  const trimmed = fileNameOrTag.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const fromTag = parseSoundFilename(trimmed);
  const name = fromTag ?? trimmed.replace(/^.*[\\/]/, "").trim();
  return resolveAudioUrl(name, "/uploads/audio") ?? name;
}

/** Giá trị có thể phát được: link http(s), file upload, [sound:…], tên file mp3 */
export function isPlayableAudio(val: string): boolean {
  const v = val.trim();
  if (!v) return false;
  if (/^\[sound:/i.test(v)) return true;
  if (/^https?:\/\//i.test(v)) return true;
  if (v.startsWith("//")) return true;
  if (v.startsWith("/uploads/") || v.startsWith("/")) return true;
  if (/^[a-z0-9.-]+\.[a-z]{2,}\/\S+/i.test(v) && /\.(mp3|wav|ogg|m4a|webm|aac|flac)/i.test(v)) return true;
  return /\.(mp3|wav|ogg|m4a|webm|aac|flac)(\?|#|$)/i.test(v);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function audioButtonHtml(url: string, text = ""): string {
  const resolved = resolveSoundPlayUrl(url);
  const dataText = text ? ` data-text="${escapeHtml(text)}"` : "";
  return `<button type="button" class="audio-btn" data-audio="${escapeHtml(resolved)}"${dataText} title="Nghe">🔊 Nghe</button>`;
}

/** Phát âm thanh qua Web Speech API tiếng Trung */
export function playSpeechTts(text: string, lang = "zh-CN"): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/<[^>]+>/g, "").trim();
      if (!clean) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = lang;
      utterance.rate = 0.85;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}

/** Phát âm thanh: ưu tiên file mp3/url, nếu lỗi 404 hoặc không có file thì tự fallback sang giọng đọc TTS tiếng Trung */
export function playAudioOrTts(
  audioUrl?: string | null,
  fallbackChineseText?: string | null,
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    const cleanText = (fallbackChineseText ?? "").replace(/<[^>]+>/g, "").trim();

    if (audioUrl && audioUrl.trim()) {
      const src = resolveSoundPlayUrl(audioUrl);
      const audio = new Audio(src);
      let resolved = false;

      const finish = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      audio.onended = finish;
      audio.onerror = () => {
        if (!resolved) {
          resolved = true;
          if (cleanText) {
            void playSpeechTts(cleanText).then(resolve);
          } else {
            resolve();
          }
        }
      };

      audio.play().catch(() => {
        if (!resolved) {
          resolved = true;
          if (cleanText) {
            void playSpeechTts(cleanText).then(resolve);
          } else {
            resolve();
          }
        }
      });
      return;
    }

    if (cleanText) {
      void playSpeechTts(cleanText).then(resolve);
    } else {
      resolve();
    }
  });
}

/** Thay [sound:file.mp3] và link audio http(s) → nút 🔊 (Anki / HyperTTS) */
export function renderTextWithSound(text: string): string {
  if (!text) return "";
  if (!/\[sound:/i.test(text) && !/https?:\/\//i.test(text)) {
    return escapeHtml(text);
  }
  let out = "";
  let last = 0;
  const combinedRe = /\[sound:([^\]]+)\]|(https?:\/\/[^\s<>"']+)/gi;
  for (const m of text.matchAll(combinedRe)) {
    const idx = m.index ?? 0;
    out += escapeHtml(text.slice(last, idx));
    if (m[1]) {
      out += audioButtonHtml(m[1]);
    } else if (m[2] && isPlayableAudio(m[2])) {
      out += audioButtonHtml(m[2]);
    } else if (m[2]) {
      out += escapeHtml(m[2]);
    }
    last = idx + m[0].length;
  }
  out += escapeHtml(text.slice(last));
  return out.replace(/\n/g, "<br>");
}

/** Trích audio từ [sound:…], link https, hoặc thẻ <audio> — giống Anki */
export function firstAudioInText(text: string): string | null {
  if (!text?.trim()) return null;
  const sound = text.match(/\[sound:([^\]]+)\]/i);
  if (sound?.[1]?.trim()) return sound[1].trim();
  const tag = text.match(/<audio[^>]+src=["']([^"']+)["']/i);
  if (tag?.[1]?.trim()) return tag[1].trim();
  const extUrl = text.match(
    /https?:\/\/[^\s<>"']+\.(?:mp3|wav|ogg|m4a|webm|aac|flac)(?:\?[^\s<>"']*)?/i,
  );
  if (extUrl?.[0]) return extUrl[0];
  const anyUrl = text.match(/https?:\/\/[^\s<>"']+/i);
  if (anyUrl?.[0] && isPlayableAudio(anyUrl[0])) return anyUrl[0];
  return null;
}

export function firstSoundInText(text: string): string | null {
  return firstAudioInText(text);
}

export function containsSoundTag(text: string): boolean {
  return /\[sound:/i.test(text);
}

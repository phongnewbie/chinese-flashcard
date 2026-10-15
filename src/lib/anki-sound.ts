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
  if (v.startsWith("/uploads/")) return true;
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

let currentAudio: HTMLAudioElement | null = null;
let ttsTimer: number | null = null;

export function stopStudyAudio() {
  currentAudio?.pause();
  currentAudio = null;
  if (typeof window !== "undefined") {
    if (ttsTimer != null) {
      window.clearTimeout(ttsTimer);
      ttsTimer = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
}

function audioButtonHtml(url: string, text = ""): string {
  const resolved = resolveSoundPlayUrl(url);
  const dataText = text ? ` data-text="${escapeHtml(text)}"` : "";
  return `<button type="button" class="audio-btn" data-audio="${escapeHtml(resolved)}"${dataText} title="Nghe">🔊 Nghe</button>`;
}

/** Lọc lấy câu tiếng Trung chuẩn để phát TTS — bỏ pinyin, tiếng Việt và mã thừa */
export function cleanChineseTtsText(raw?: string | null): string {
  if (!raw?.trim()) return "";
  let text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\[sound:[^\]]+\]/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .trim();

  // Dạng slash: "她在看书 / tā zài kànshū / Cô ấy đang đọc sách"
  if (text.includes("/")) {
    const parts = text.split("/").map((p) => p.trim());
    const cnPart = parts.find((p) => /[\u4e00-\u9fa5]/.test(p));
    if (cnPart) text = cnPart;
  }

  // Dạng nhiều dòng: lấy dòng đầu có chữ Hán
  if (text.includes("\n")) {
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    const cnLine = lines.find((l) => /[\u4e00-\u9fa5]/.test(l));
    if (cnLine) text = cnLine;
  }

  // Loại bỏ các tiền tố mã thẻ ví dụ: "NP1: ", "MÃ: NP1", "1. "
  text = text.replace(/^(?:MÃ|MA|STT|NP\d+|[A-Z0-9_-]+)[:：\s]+/gi, "").trim();

  // Nếu không chứa ký tự chữ Hán, không phát âm tiếng Trung
  if (!/[\u4e00-\u9fa5]/.test(text)) {
    return "";
  }

  return text;
}

/** Phát âm thanh qua Web Speech API tiếng Trung */
export function playSpeechTts(text: string, lang = "zh-CN"): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    try {
      let clean = text.replace(/<[^>]+>/g, "").trim();
      if (lang.startsWith("zh")) {
        clean = cleanChineseTtsText(clean);
      }
      if (!clean) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = lang;
      utterance.rate = 0.85;

      // Chọn voice tiếng Trung chuẩn nếu có
      if (lang.startsWith("zh")) {
        const voices = window.speechSynthesis.getVoices();
        const zhVoice = voices.find(
          (v) => v.lang.replace("_", "-").toLowerCase().startsWith("zh") || v.name.includes("Chinese"),
        );
        if (zhVoice) utterance.voice = zhVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.cancel();
      // Trì hoãn ngắn — tránh TTS bị nuốt lần phát đầu (Chrome)
      ttsTimer = window.setTimeout(() => {
        ttsTimer = null;
        try {
          window.speechSynthesis.speak(utterance);
        } catch {
          resolve();
        }
      }, 50);
    } catch {
      resolve();
    }
  });
}

export function stripSpeakText(raw?: string | null): string {
  return (raw ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[sound:[^\]]+\]/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chỉ trả URL khi đúng là file/link nghe được — tránh TTS lệch vì nhầm URL */
export function playableAudioSrc(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const cleaned = stripSpeakText(raw) || raw.trim();
  const candidate = isPlayableAudio(raw.trim()) ? raw.trim() : isPlayableAudio(cleaned) ? cleaned : "";
  if (!candidate) return null;
  return resolveSoundPlayUrl(candidate);
}

export type AudioPlayItem = {
  audioUrl?: string | null;
  text?: string | null;
  lang?: string;
};

/** Phát âm thanh: ưu tiên file mp3/url, nếu lỗi thì fallback TTS (zh-CN hoặc vi-VN) */
export function playAudioOrTts(
  audioUrl?: string | null,
  fallbackText?: string | null,
  lang = "zh-CN",
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    const cleanText = lang.startsWith("zh")
      ? cleanChineseTtsText(fallbackText)
      : (fallbackText ?? "").replace(/<[^>]+>/g, "").trim();

    if (audioUrl && audioUrl.trim()) {
      const src = resolveSoundPlayUrl(audioUrl);
      stopStudyAudio();
      const audio = new Audio(src);
      currentAudio = audio;
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
            void playSpeechTts(cleanText, lang).then(resolve);
          } else {
            resolve();
          }
        }
      };

      audio.play().catch(() => {
        if (!resolved) {
          resolved = true;
          if (cleanText) {
            void playSpeechTts(cleanText, lang).then(resolve);
          } else {
            resolve();
          }
        }
      });
      return;
    }

    if (cleanText) {
      stopStudyAudio();
      void playSpeechTts(cleanText, lang).then(resolve);
    } else {
      resolve();
    }
  });
}

/** Phát lần lượt nhiều đoạn âm thanh (vd: từ vựng rồi đặt câu) */
export async function playAudioSequence(items: AudioPlayItem[]): Promise<void> {
  for (const item of items) {
    const text = item.text?.trim();
    const url = item.audioUrl?.trim();
    if (!text && !url) continue;
    await playAudioOrTts(url, text, item.lang ?? "zh-CN");
  }
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

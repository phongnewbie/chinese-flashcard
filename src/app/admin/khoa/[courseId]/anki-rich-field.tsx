"use client";

import { useEffect, useRef } from "react";
import {
  clipboardImageFile,
  extractImageSrcFromField,
  uploadImageFile,
} from "@/lib/paste-image";

type Props = {
  value: string;
  uploading?: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
  onError?: (msg: string) => void;
  placeholder?: string;
  minHeight?: number;
};

/** Chuẩn hóa HTML cũ (field-img-wrap) → img đơn giản để hiển thị đúng */
function normalizeRichHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const src = extractImageSrcFromField(trimmed);
  if (!src) return trimmed;
  const textOnly = trimmed.replace(/<[^>]*>/g, "").replace(/\s/g, "");
  if (textOnly === "" || trimmed.includes("field-img-wrap")) {
    return `<p><img src="${src.replace(/"/g, "")}" alt="" class="field-img" /></p>`;
  }
  return trimmed;
}

function insertImageAtCursor(container: HTMLElement, url: string) {
  const img = document.createElement("img");
  img.src = url;
  img.alt = "";
  img.className = "field-img";

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && container.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(img);
    range.setStartAfter(img);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }

  container.appendChild(img);
}

/** Trường HTML (GHI CHÚ, VÍ DỤ…) — paste ảnh hiện ngay trong ô, giống Anki */
export function AnkiRichField({
  value,
  uploading,
  onChange,
  onFocus,
  onUploadStart,
  onUploadEnd,
  onError,
  placeholder,
  minHeight = 88,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || value === lastValueRef.current) return;
    lastValueRef.current = value;
    const html = normalizeRichHtml(value);
    if (el.innerHTML !== html) {
      el.innerHTML = html || "";
    }
  }, [value]);

  const sync = () => {
    const html = ref.current?.innerHTML ?? "";
    const normalized = html === "<br>" || html === "<p><br></p>" ? "" : html;
    lastValueRef.current = normalized;
    onChange(normalized);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const file = clipboardImageFile(e.clipboardData);
    if (!file) return;
    e.preventDefault();
    e.stopPropagation();
    onUploadStart?.();
    try {
      const uploaded = await uploadImageFile(file);
      const el = ref.current;
      if (!el) return;
      el.focus();
      insertImageAtCursor(el, uploaded.url);
      sync();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Không tải được ảnh");
    } finally {
      onUploadEnd?.();
    }
  };

  return (
    <div className="anki-rich-field-wrap">
      {uploading && <div className="anki-image-uploading">Đang tải ảnh…</div>}
      <div
        ref={ref}
        className="anki-rich-field"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder ?? "Gõ hoặc copy ảnh rồi Ctrl+V"}
        style={{ minHeight }}
        onInput={sync}
        onFocus={onFocus}
        onPaste={(e) => void handlePaste(e)}
        onBlur={sync}
      />
    </div>
  );
}

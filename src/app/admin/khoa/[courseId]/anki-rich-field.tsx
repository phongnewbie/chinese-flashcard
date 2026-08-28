"use client";

import { useEffect, useRef } from "react";
import { clipboardImageFile, uploadImageFile } from "@/lib/paste-image";

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
    const html = value.trim() ? value : "";
    if (el.innerHTML !== html) {
      el.innerHTML = html || "";
    }
  }, [value]);

  const sync = () => {
    const html = ref.current?.innerHTML ?? "";
    const normalized = html === "<br>" ? "" : html;
    lastValueRef.current = normalized;
    onChange(normalized);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const file = clipboardImageFile(e.clipboardData);
    if (!file) return;
    e.preventDefault();
    onUploadStart?.();
    try {
      const uploaded = await uploadImageFile(file);
      const tag = `<img src="${uploaded.url.replace(/"/g, "")}" alt="" class="field-img" />`;
      ref.current?.focus();
      document.execCommand("insertHTML", false, tag);
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

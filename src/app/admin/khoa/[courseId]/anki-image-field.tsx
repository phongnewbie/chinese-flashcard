"use client";

import { useState } from "react";
import {
  applyImageAlign,
  extractImageSrcFromField,
  parseImageAlign,
  type ImageAlign,
} from "@/lib/paste-image";

type Props = {
  value: string;
  uploading?: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
  onPaste: (e: React.ClipboardEvent) => void;
};

export function AnkiImageField({ value, uploading, onChange, onFocus, onPaste }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(false);
  const src = extractImageSrcFromField(value);
  const align = parseImageAlign(value);

  const setAlign = (next: ImageAlign) => {
    onChange(applyImageAlign(value, next));
  };

  return (
    <>
      <div
        className={`anki-image-slot${selected && src ? " selected" : ""}${!src ? " empty" : ""}`}
        tabIndex={0}
        onFocus={() => {
          onFocus();
          setSelected(true);
        }}
        onBlur={() => setSelected(false)}
        onPaste={onPaste}
      >
        {uploading && <div className="anki-image-uploading">Đang tải ảnh…</div>}
        {src ? (
          <>
            <div className={`anki-image-wrap align-${align}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                title="ấn để mở rộng"
                onClick={() => setExpanded(true)}
                draggable={false}
              />
            </div>
            <div className="anki-image-toolbar">
              <button type="button" title="Căn trái" className={align === "left" ? "on" : ""} onClick={() => setAlign("left")}>
                ⬅
              </button>
              <button type="button" title="Căn giữa" className={align === "center" ? "on" : ""} onClick={() => setAlign("center")}>
                ⊞
              </button>
              <button type="button" title="Căn phải" className={align === "right" ? "on" : ""} onClick={() => setAlign("right")}>
                ➡
              </button>
              <button type="button" title="Full width" className={align === "full" ? "on" : ""} onClick={() => setAlign("full")}>
                ⛶
              </button>
              <span className="anki-image-toolbar-sep" />
              <button type="button" title="Xóa ảnh" onClick={() => onChange("")}>
                ✕
              </button>
            </div>
          </>
        ) : (
          <div className="anki-image-placeholder">
            {uploading ? "…" : "Copy ảnh rồi Ctrl+V — hoặc bấm 🖼 trên thanh công cụ"}
          </div>
        )}
      </div>

      {expanded && src && (
        <div className="anki-image-lightbox" onClick={() => setExpanded(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

export function fieldImagePreview(value: string): string | null {
  return extractImageSrcFromField(value);
}

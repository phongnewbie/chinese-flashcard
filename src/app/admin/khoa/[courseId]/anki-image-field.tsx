"use client";

import { useState } from "react";
import {
  applyImageAlign,
  extractAllImageSrcFromField,
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState(false);
  const srcs = extractAllImageSrcFromField(value);
  const src = srcs[0] ?? null;
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
              {srcs.map((s) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={s}
                  src={s}
                  alt=""
                  title="ấn để mở rộng"
                  onClick={() => setExpanded(s)}
                  draggable={false}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).alt = "Không tải được ảnh — thử paste lại";
                  }}
                />
              ))}
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

      {expanded && (
        <div className="anki-image-lightbox" onClick={() => setExpanded(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={expanded} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

export function fieldImagePreview(value: string): string | null {
  return extractAllImageSrcFromField(value)[0] ?? null;
}

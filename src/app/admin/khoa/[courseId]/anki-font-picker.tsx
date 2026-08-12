"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ANKI_FONT_CHOICES } from "@/lib/field-defs";

type Props = {
  value: string;
  onChange: (font: string) => void;
  id?: string;
};

export function AnkiFontPicker({ value, onChange, id }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if ((t as Element).closest?.(".anki-font-picker-list")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const openList = () => {
    const btn = btnRef.current;
    if (btn) {
      const r = btn.getBoundingClientRect();
      setPos({ top: r.bottom + 2, left: r.left, width: r.width });
    }
    setOpen(true);
  };

  const fonts = ANKI_FONT_CHOICES.includes(value as (typeof ANKI_FONT_CHOICES)[number])
    ? [...ANKI_FONT_CHOICES]
    : [value, ...ANKI_FONT_CHOICES];

  const list = open ? (
    <ul
      className="anki-font-picker-list"
      role="listbox"
      style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 220) }}
    >
      {fonts.map((font) => (
        <li key={font} role="option" aria-selected={font === value}>
          <button
            type="button"
            className={font === value ? "sel" : ""}
            style={{ fontFamily: font }}
            onClick={() => {
              onChange(font);
              setOpen(false);
            }}
          >
            <span className="anki-font-tt">TT</span>
            <span className="anki-font-name">{font}</span>
          </button>
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <div className="anki-font-picker" ref={wrapRef}>
      <button
        type="button"
        id={id}
        ref={btnRef}
        className="anki-font-picker-btn"
        style={{ fontFamily: value }}
        onClick={() => (open ? setOpen(false) : openList())}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Chọn font chữ"
      >
        <span className="anki-font-picker-label">{value}</span>
        <span className="anki-font-picker-arrow">▾</span>
      </button>
      {typeof document !== "undefined" && list ? createPortal(list, document.body) : null}
    </div>
  );
}

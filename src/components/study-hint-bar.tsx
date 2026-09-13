"use client";

import { stripFieldHtml, type HintLine } from "@/lib/study-options";

type Props = {
  hints: HintLine[];
  label?: string;
  visible: boolean;
  onToggle: () => void;
};

export function StudyHintBar({ hints, label = "Gợi ý", visible, onToggle }: Props) {
  if (!hints.length) return null;

  return (
    <div className="w-full max-w-md mx-auto shrink-0 space-y-2">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onToggle}
          className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 transition"
        >
          💡 {visible ? "Ẩn gợi ý" : label}
        </button>
      </div>
      {visible && (
        <div className="hsk-hints rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-left space-y-1.5">
          {hints.map((h) => (
            <p key={h.label}>
              <strong className="text-emerald-900">{h.label}:</strong>{" "}
              <span className="text-stone-700">{stripFieldHtml(h.value)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

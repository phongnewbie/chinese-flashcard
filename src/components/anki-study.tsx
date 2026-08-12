"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  renderCardTemplate,
  toCardFields,
  type TemplateFields,
} from "@/lib/card-template";
import { previewIntervals, type ReviewState } from "@/lib/srs";

type StudyCard = {
  id: string;
  front: string;
  back: string;
  pinyin: string | null;
  audioUrl: string | null;
  extraFields: string | null;
  section: string;
  cardType: string;
  cardTypeLabel: string;
  srs: ReviewState & { isNew?: boolean };
};

type Templates = {
  frontTemplate: string;
  backTemplate: string;
  cardCss: string;
};

type Props = {
  courseId: string;
  section: string;
  mode: "review" | "all" | "new";
  onStats?: (stats: { due: number; new: number; queue: number }) => void;
};

export function AnkiStudy({ courseId, section, mode, onStats }: Props) {
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [templates, setTemplates] = useState<Templates | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setDone(false);
    setIndex(0);
    setFlipped(false);
    const res = await fetch(
      `/api/courses/${courseId}/study?section=${section}&mode=${mode}`,
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return;
    setCards(data.cards);
    setTemplates(data.templates);
    onStats?.(data.stats);
    if (data.cards.length === 0) setDone(true);
  }, [courseId, section, mode, onStats]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = cards[index];

  const fields: TemplateFields | null = useMemo(
    () => (current ? toCardFields(current) : null),
    [current],
  );

  const intervals = useMemo(
    () => (current ? previewIntervals(current.srs) : null),
    [current],
  );

  const playAudio = (url: string) => {
    void new Audio(url).play();
  };

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const btn = t.closest("[data-audio]") as HTMLElement | null;
      if (btn?.dataset.audio) playAudio(btn.dataset.audio);
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [flipped, current?.id]);

  const rate = async (rating: 1 | 2 | 3 | 4) => {
    if (!current) return;
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: current.id, cardType: current.cardType, rating }),
    });
    const data = await res.json();
    setFlipped(false);
    const requeueMs = data.requeueInMs as number | null;
    if (requeueMs != null && requeueMs > 0 && requeueMs <= 15 * 60_000) {
      setTimeout(() => {
        setCards((prev) => {
          if (prev.some((c) => c.id === current.id && c.cardType === current.cardType && index < prev.length)) {
            return prev;
          }
          return [...prev, current];
        });
        setDone(false);
      }, requeueMs);
    }
    if (index + 1 >= cards.length) {
      setDone(true);
      void load();
    } else {
      setIndex((i) => i + 1);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || !current) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) setFlipped(true);
      }
      if (flipped) {
        if (e.key === "1") void rate(1);
        if (e.key === "2") void rate(2);
        if (e.key === "3") void rate(3);
        if (e.key === "4") void rate(4);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, current, done, index, cards.length]);

  if (loading) return <p className="text-stone-500 text-center">Đang tải thẻ…</p>;

  if (done || !current || !templates || !fields) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-lg font-medium text-stone-800">Hoàn thành phiên học!</p>
        <p className="text-sm text-stone-500">
          {mode === "review"
            ? "Không còn thẻ đến hạn. Quay lại sau hoặc chọn “Học tất cả”."
            : "Đã hết thẻ trong chế độ này."}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl bg-emerald-600 text-white px-6 py-2.5 text-sm"
        >
          Học tiếp
        </button>
      </div>
    );
  }

  const html = flipped
    ? renderCardTemplate(templates.backTemplate, fields, "back")
    : renderCardTemplate(templates.frontTemplate, fields, "front");

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between text-sm text-stone-500">
        <span>
          {index + 1} / {cards.length}
          {current.srs.isNew && (
            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
              Mới
            </span>
          )}
          {current.cardTypeLabel && current.cardType !== "default" && (
            <span className="ml-2 text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">
              {current.cardTypeLabel}
            </span>
          )}
        </span>
        {!flipped && current.audioUrl && (
          <button
            type="button"
            onClick={() => playAudio(current.audioUrl!)}
            className="text-emerald-700 text-xs hover:underline"
          >
            🔊 Nghe
          </button>
        )}
      </div>

      <style>{templates.cardCss}</style>
      <button
        type="button"
        onClick={() => !flipped && setFlipped(true)}
        className="w-full min-h-[280px] rounded-2xl border-2 border-stone-200 bg-white p-4 shadow-sm text-left transition hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        <div
          ref={cardRef}
          className="anki-card-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </button>

      {!flipped ? (
        <p className="text-center text-xs text-stone-400">Space — lật thẻ</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <RateBtn label="Again" sub={intervals?.again} color="red" onClick={() => void rate(1)} hotkey="1" />
          <RateBtn label="Hard" sub={intervals?.hard} color="amber" onClick={() => void rate(2)} hotkey="2" />
          <RateBtn label="Good" sub={intervals?.good} color="emerald" onClick={() => void rate(3)} hotkey="3" />
          <RateBtn label="Easy" sub={intervals?.easy} color="blue" onClick={() => void rate(4)} hotkey="4" />
        </div>
      )}
    </div>
  );
}

function RateBtn({
  label,
  sub,
  color,
  onClick,
  hotkey,
}: {
  label: string;
  sub?: string;
  color: "red" | "amber" | "emerald" | "blue";
  onClick: () => void;
  hotkey: string;
}) {
  const colors = {
    red: "bg-red-50 border-red-200 text-red-900 hover:bg-red-100",
    amber: "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100",
    blue: "bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${colors[color]}`}
    >
      <span className="block">{label}</span>
      <span className="block text-xs opacity-70">{sub}</span>
      <span className="block text-[10px] opacity-50 mt-0.5">{hotkey}</span>
    </button>
  );
}

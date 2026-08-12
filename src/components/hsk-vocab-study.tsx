"use client";

import { useCallback, useEffect, useState } from "react";
import {
  answersMatch,
  formatHints,
  hanziiSearchUrl,
  toHskCardView,
  type HskCardView,
} from "@/lib/hsk-card";
import { previewIntervals } from "@/lib/srs";

type StudyCard = Parameters<typeof toHskCardView>[0];

type Props = {
  courseId: string;
  mode: "review" | "all" | "new";
  onStats?: (stats: { due: number; new: number; queue: number; learning: number }) => void;
};

export function HskVocabStudy({ courseId, mode, onStats }: Props) {
  const [title, setTitle] = useState("TỪ VỰNG HSK");
  const [cards, setCards] = useState<HskCardView[]>([]);
  const [rawCards, setRawCards] = useState<StudyCard[]>([]);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [counts, setCounts] = useState({ new: 0, learning: 0, due: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setDone(false);
    setIndex(0);
    setTyped("");
    setRevealed(false);
    const res = await fetch(
      `/api/courses/${courseId}/study?section=vocabulary&mode=${mode}`,
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return;
    setTitle(data.title?.toUpperCase() ?? "TỪ VỰNG HSK");
    const mapped = (data.cards as StudyCard[]).map(toHskCardView);
    setRawCards(data.cards);
    setCards(mapped);
    const learning = (data.cards as StudyCard[]).filter(
      (c) => !c.srs.isNew && (c.srs.intervalDays ?? 0) === 0,
    ).length;
    setCounts({
      new: data.stats.new,
      learning,
      due: data.stats.due,
    });
    onStats?.({ ...data.stats, learning });
    if (mapped.length === 0) setDone(true);
  }, [courseId, mode, onStats]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = cards[index];
  const currentRaw = rawCards[index];

  const showAnswer = () => setRevealed(true);

  const rate = async (rating: 1 | 2 | 3 | 4) => {
    if (!current || !currentRaw) return;
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId: current.id,
        cardType: (currentRaw as { cardType?: string }).cardType ?? "viet_trung",
        rating,
      }),
    });
    const data = await res.json();
    const requeueMs = data.requeueInMs as number | null;
    if (requeueMs != null && requeueMs > 0 && requeueMs <= 15 * 60_000) {
      setTimeout(() => {
        setCards((prev) => [...prev, current]);
        setRawCards((prev) => [...prev, currentRaw]);
        setDone(false);
      }, requeueMs);
    }
    setRevealed(false);
    setTyped("");
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
      if (!revealed && e.key === "Enter") {
        e.preventDefault();
        showAnswer();
      }
      if (revealed) {
        if (e.key === "1") void rate(1);
        if (e.key === "2") void rate(2);
        if (e.key === "3") void rate(3);
        if (e.key === "4") void rate(4);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, current, done, index, cards.length]);

  if (loading) {
    return <p className="text-center text-stone-500 py-12">Đang tải thẻ…</p>;
  }

  if (done || !current || !currentRaw) {
    return (
      <div className="hsk-screen rounded-2xl p-8 text-center space-y-4">
        <p className="text-lg font-medium">Hoàn thành phiên học!</p>
        <button
          type="button"
          onClick={() => void load()}
          className="hsk-show-btn px-8 py-2"
        >
          Học tiếp
        </button>
      </div>
    );
  }

  const hints = formatHints(current.hints);
  const correct = answersMatch(typed, current.answer);
  const intervals = previewIntervals(currentRaw.srs as Parameters<typeof previewIntervals>[0]);

  return (
    <div className="hsk-screen rounded-2xl overflow-hidden">
      {/* Header pill */}
      <div className="relative px-4 pt-6 pb-2">
        <div className="hsk-header-pill mx-auto max-w-md text-center py-2.5 px-6">
          {title}
        </div>
        <span className="hsk-level-badge absolute right-6 top-8">{current.hskLevel}</span>
        {current.cardTypeLabel && current.cardType !== "viet_trung" && (
          <span className="absolute left-6 top-8 text-xs bg-white/80 px-2 py-1 rounded">
            {current.cardTypeLabel}
          </span>
        )}
      </div>

      {!revealed && (
        <div className="flex justify-center px-6 py-4 min-h-[140px] items-center">
          {current.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.imageUrl}
              alt=""
              className="max-h-36 max-w-full object-contain rounded-lg shadow-sm"
            />
          ) : (
            <div className="w-32 h-32 rounded-lg bg-white/40 flex items-center justify-center text-stone-400 text-xs">
              Chưa có ảnh
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="mx-4 mb-4 space-y-3">
        {!revealed ? (
          <div className="hsk-question-card rounded-xl p-5 space-y-4">
            <div className="flex gap-3 items-start">
              <span className="text-pink-400 text-2xl font-bold leading-none">?</span>
              <div className="hsk-hints text-base space-y-1 flex-1">
                {hints.map((h, i) => (
                  <p key={i}>
                    {hints.length > 1 ? `${i + 1}. ` : ""}
                    {h}
                  </p>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Gõ chữ Hán..."
              className="hsk-input w-full rounded-lg px-4 py-3 text-lg text-center outline-none"
              autoFocus
              lang="zh-CN"
            />
          </div>
        ) : (
          <HskAnswerBack
            card={current}
            typed={typed}
            correct={correct}
            hints={hints}
          />
        )}
      </div>

      {/* Stats + action */}
      <div className="px-4 pb-6 space-y-4">
        <p className="text-center text-sm">
          <span className="text-blue-600 font-medium">{counts.new}</span>
          <span className="text-stone-400 mx-1">+</span>
          <span className="text-red-500 font-medium">{counts.learning}</span>
          <span className="text-stone-400 mx-1">+</span>
          <span className="text-emerald-600 font-medium">{counts.due}</span>
        </p>

        {!revealed ? (
          <div className="flex justify-center">
            <button type="button" onClick={showAnswer} className="hsk-show-btn px-10 py-2.5">
              Hiện đáp án
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-lg mx-auto">
            <RateBtn label="Again" sub={intervals.again} tone="red" onClick={() => void rate(1)} />
            <RateBtn label="Hard" sub={intervals.hard} tone="amber" onClick={() => void rate(2)} />
            <RateBtn label="Good" sub={intervals.good} tone="green" onClick={() => void rate(3)} />
            <RateBtn label="Easy" sub={intervals.easy} tone="blue" onClick={() => void rate(4)} />
          </div>
        )}

        <p className="text-center text-xs text-stone-500">
          {index + 1} / {cards.length}
        </p>
      </div>
    </div>
  );
}

function HskAnswerBack({
  card,
  typed,
  correct,
  hints,
}: {
  card: HskCardView;
  typed: string;
  correct: boolean;
  hints: string[];
}) {
  const showWrongCompare = !correct && typed.trim().length > 0;

  return (
    <div className="space-y-3">
      {/* Pinyin tag + wrong answer comparison */}
      <div className="relative flex flex-col items-center gap-2 pt-1">
        {showWrongCompare && (
          <div className="text-center space-y-1 mb-1">
            <p className="text-3xl font-medium text-red-700">{typed}</p>
            <p className="text-stone-400 text-lg leading-none">↓</p>
          </div>
        )}
        {card.pinyin && (
          <span className="hsk-pinyin-badge">{card.pinyin}</span>
        )}
      </div>

      {/* Image */}
      <div className="flex justify-center py-2 min-h-[120px] items-center">
        {card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.imageUrl}
            alt=""
            className="max-h-32 max-w-full object-contain rounded-lg shadow-sm bg-white/50"
          />
        ) : null}
      </div>

      {/* Large character */}
      <div className="hsk-char-display mx-auto max-w-[200px] text-center py-4 px-6 rounded-xl bg-white/90 shadow-sm">
        <span className="text-6xl font-semibold text-stone-900">{card.answer}</span>
      </div>

      {/* Definition card */}
      <div className="hsk-answer-card rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-lg">
          <span className="text-2xl font-bold text-stone-900">{card.answer}</span>
          {card.pinyin && (
            <span className="text-stone-600">/{card.pinyin}/</span>
          )}
          {card.audioUrl && <AudioBtn url={card.audioUrl} />}
        </div>
        <div className="hsk-hints text-sm space-y-1">
          {hints.map((h, i) => (
            <p key={i}>
              {hints.length > 1 ? `${i + 1}. ` : ""}
              {h}
            </p>
          ))}
        </div>
      </div>

      {/* Example sentence */}
      {card.example && (card.example.chinese || card.example.vietnamese) && (
        <div className="hsk-example-card rounded-xl p-4">
          <div className="flex gap-2 items-start">
            <span className="text-blue-500 text-lg leading-none mt-0.5">•</span>
            <div className="flex-1 text-sm space-y-1">
              {card.example.chinese && (
                <p className="font-medium text-stone-900">{card.example.chinese}</p>
              )}
              {card.example.pinyin && (
                <p className="text-stone-500 italic">/{card.example.pinyin}/</p>
              )}
              {card.example.vietnamese && (
                <p className="text-stone-700">{card.example.vietnamese}</p>
              )}
            </div>
            {card.exampleAudioUrl && <AudioBtn url={card.exampleAudioUrl} />}
          </div>
        </div>
      )}

      {/* Mnemonic / etymology */}
      {card.mnemonic && (
        <div className="hsk-mnemonic-card rounded-xl p-4 text-sm whitespace-pre-line leading-relaxed">
          {card.mnemonic}
        </div>
      )}

      {/* Hanzii dictionary */}
      <div className="flex justify-center pt-1">
        <a
          href={hanziiSearchUrl(card.answer)}
          target="_blank"
          rel="noopener noreferrer"
          className="hsk-hanzii-btn inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold"
        >
          <span aria-hidden>🔍</span> Hanzii
        </a>
      </div>

      {correct && (
        <p className="text-center text-sm text-emerald-700 font-medium">Chính xác!</p>
      )}
    </div>
  );
}

function AudioBtn({ url }: { url: string }) {
  return (
    <button
      type="button"
      aria-label="Phát âm"
      className="hsk-audio-btn w-8 h-8 rounded-full inline-flex items-center justify-center text-sm shrink-0"
      onClick={() => void new Audio(url).play()}
    >
      🔊
    </button>
  );
}

function RateBtn({
  label,
  sub,
  tone,
  onClick,
}: {
  label: string;
  sub: string;
  tone: "red" | "amber" | "green" | "blue";
  onClick: () => void;
}) {
  const tones = {
    red: "bg-red-100 hover:bg-red-200 text-red-900 border-red-200",
    amber: "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-200",
    green: "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-200",
    blue: "bg-blue-100 hover:bg-blue-200 text-blue-900 border-blue-200",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${tones[tone]}`}
    >
      <span className="block">{label}</span>
      <span className="block text-[10px] opacity-70">{sub}</span>
    </button>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Card = {
  id: string;
  front: string;
  back: string;
  pinyin: string | null;
  audioUrl: string | null;
};

export function FlashcardStudy({ cards }: { cards: Card[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setOrder(cards.map((_, i) => i));
    setIndex(0);
    setFlipped(false);
  }, [cards]);

  const current = cards[order[index] ?? 0];

  const next = useCallback(() => {
    setFlipped(false);
    setIndex((i) => (i + 1) % order.length);
  }, [order.length]);

  const prev = useCallback(() => {
    setFlipped(false);
    setIndex((i) => (i - 1 + order.length) % order.length);
  }, [order.length]);

  const toggleShuffle = () => {
    setShuffle((s) => {
      const nextShuffle = !s;
      if (nextShuffle) {
        const shuffled = [...order].sort(() => Math.random() - 0.5);
        setOrder(shuffled);
        setIndex(0);
      } else {
        setOrder(cards.map((_, i) => i));
        setIndex(0);
      }
      setFlipped(false);
      return nextShuffle;
    });
  };

  const playAudio = () => {
    if (!current?.audioUrl) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(current.audioUrl);
    audioRef.current = audio;
    void audio.play();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  if (!current) {
    return (
      <p className="text-center text-stone-500">Chưa có thẻ trong khóa này.</p>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between text-sm text-stone-500">
        <span>
          Thẻ {index + 1} / {order.length}
        </span>
        <button
          type="button"
          onClick={toggleShuffle}
          className="rounded-lg border border-stone-200 px-3 py-1 hover:bg-stone-50"
        >
          {shuffle ? "Tắt trộn" : "Trộn thẻ"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="w-full min-h-[280px] rounded-2xl border-2 border-stone-200 bg-gradient-to-br from-white to-stone-50 p-8 shadow-sm text-left transition hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        {!flipped ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-4xl md:text-5xl font-medium text-stone-900">{current.front}</p>
            {current.pinyin && (
              <p className="text-lg text-stone-500">{current.pinyin}</p>
            )}
            <p className="text-xs text-stone-400 mt-4">Chạm để xem nghĩa</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-2xl text-emerald-800 font-medium">{current.back}</p>
            {current.pinyin && <p className="text-stone-500">{current.pinyin}</p>}
            <p className="text-3xl mt-2 text-stone-800">{current.front}</p>
          </div>
        )}
      </button>

      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={prev}
          className="rounded-xl border border-stone-200 px-5 py-2.5 hover:bg-stone-50"
        >
          ← Trước
        </button>
        {current.audioUrl && (
          <button
            type="button"
            onClick={playAudio}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-white hover:bg-emerald-700"
          >
            🔊 Nghe
          </button>
        )}
        <button
          type="button"
          onClick={next}
          className="rounded-xl bg-stone-900 px-5 py-2.5 text-white hover:bg-stone-800"
        >
          Sau →
        </button>
      </div>
    </div>
  );
}

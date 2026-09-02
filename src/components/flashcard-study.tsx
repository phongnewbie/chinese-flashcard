"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extractImageUrl } from "@/lib/hsk-card";

type Card = {
  id: string;
  front: string;
  back: string;
  pinyin: string | null;
  audioUrl: string | null;
  extraFields?: string | null;
  imageUrl?: string | null;
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

  const imageUrl = current
    ? current.imageUrl || extractImageUrl(current.extraFields ?? undefined)
    : "";

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
      <p className="text-center text-stone-500 py-12">Chưa có thẻ trong khóa này.</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between text-sm text-stone-500 px-1">
        <span className="font-medium">
          Thẻ {index + 1} / {order.length}
        </span>
        <button
          type="button"
          onClick={toggleShuffle}
          className="rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 hover:bg-stone-50 text-xs font-semibold shadow-xs"
        >
          {shuffle ? "✓ Đang trộn thẻ" : "Trộn thẻ"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="w-full min-h-[480px] md:min-h-[520px] rounded-2xl border-2 border-[#8fad8f] bg-white p-6 md:p-8 shadow-sm text-left transition hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 flex flex-col justify-center cursor-pointer"
      >
        {!flipped ? (
          <div className="flex flex-col items-center justify-center my-auto gap-4 text-center w-full">
            {imageUrl && (
              <div className="max-h-48 my-1 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="max-h-44 max-w-full object-contain rounded-xl border border-stone-100 shadow-xs"
                />
              </div>
            )}
            <p className="text-4xl md:text-5xl lg:text-6xl font-bold text-stone-900 tracking-wide">
              {current.front}
            </p>
            {current.pinyin && (
              <span className="text-lg md:text-xl font-medium text-amber-800 bg-amber-50 border border-amber-200 px-4 py-1 rounded-full">
                {current.pinyin}
              </span>
            )}
            <p className="text-xs text-stone-400 mt-6">Chạm hoặc nhấn Space để xem nghĩa</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center my-auto gap-4 text-center w-full">
            {imageUrl && (
              <div className="max-h-44 my-1 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="max-h-40 max-w-full object-contain rounded-xl border border-stone-100 shadow-xs"
                />
              </div>
            )}
            <p className="text-2xl md:text-3xl text-emerald-800 font-semibold">{current.back}</p>
            {current.pinyin && (
              <span className="text-base md:text-lg font-medium text-stone-600">
                /{current.pinyin}/
              </span>
            )}
            <p className="text-3xl md:text-4xl mt-2 font-bold text-stone-800">{current.front}</p>
          </div>
        )}
      </button>

      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={prev}
          className="rounded-xl border border-stone-200 bg-white px-6 py-2.5 hover:bg-stone-50 font-medium text-stone-700 shadow-xs"
        >
          ← Trước
        </button>
        {current.audioUrl && (
          <button
            type="button"
            onClick={playAudio}
            className="rounded-xl bg-emerald-600 px-6 py-2.5 text-white hover:bg-emerald-700 font-medium shadow-xs"
          >
            🔊 Nghe
          </button>
        )}
        <button
          type="button"
          onClick={next}
          className="rounded-xl bg-stone-900 px-6 py-2.5 text-white hover:bg-stone-800 font-medium shadow-xs"
        >
          Sau →
        </button>
      </div>
    </div>
  );
}

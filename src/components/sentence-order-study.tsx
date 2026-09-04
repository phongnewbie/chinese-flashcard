"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AnkiDeckOverview,
  AnkiSessionFinished,
  type DeckStats,
} from "@/components/anki-deck-overview";
import { playAudioOrTts } from "@/lib/anki-sound";

type Card = {
  id: string;
  front: string;
  back: string;
  pinyin: string | null;
  audioUrl?: string | null;
  cardType?: string;
  srs?: { isNew?: boolean; intervalDays?: number };
};

function splitParts(front: string): string[] {
  if (front.includes("|")) return front.split("|").map((s) => s.trim()).filter(Boolean);
  if (front.includes("/")) return front.split("/").map((s) => s.trim()).filter(Boolean);
  if (front.includes(" ")) return front.split(/\s+/).filter(Boolean);
  return front.split("").filter(Boolean);
}

function normalizeSentence(s: string) {
  return s.replace(/\s+/g, "").trim();
}

export function SentenceOrderStudy({
  courseId,
  mode = "review",
  onModeChange,
}: {
  courseId: string;
  mode?: "review" | "all" | "new";
  onModeChange: (mode: "review" | "all" | "new") => void;
}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [stats, setStats] = useState<DeckStats>({ new: 0, learning: 0, due: 0, queue: 0, total: 0 });
  const [title, setTitle] = useState("SẮP XẾP CÂU");
  const [phase, setPhase] = useState<"overview" | "study" | "finished">("overview");
  const [sessionCount, setSessionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const current = phase === "study" ? cards[index] : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setIndex(0);
    const res = await fetch(
      `/api/courses/${courseId}/study?section=sentence_order&mode=${mode}`,
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return;
    setCards(data.cards ?? []);
    setTitle(data.title?.toUpperCase() ?? "SẮP XẾP CÂU");
    setStats({
      new: data.stats?.new ?? 0,
      learning: data.stats?.learning ?? 0,
      due: data.stats?.due ?? 0,
      queue: data.stats?.queue ?? 0,
      total: data.stats?.total,
    });
    setPhase("overview");
  }, [courseId, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const parts = useMemo(
    () => (current ? splitParts(current.front) : []),
    [current],
  );

  const [pool, setPool] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [checked, setChecked] = useState<"idle" | "ok" | "fail">("idle");

  const resetRound = useCallback(
    (shuffled?: string[]) => {
      const base = shuffled ?? [...parts].sort(() => Math.random() - 0.5);
      setPool(base);
      setPicked([]);
      setChecked("idle");
    },
    [parts],
  );

  useEffect(() => {
    if (current) resetRound();
  }, [current?.id, resetRound]);

  useEffect(() => {
    if (phase !== "study" || !current) return;
    const chinese = (current.back.split("\n")[0] ?? current.back).trim();
    if (!chinese) return;
    void playAudioOrTts(current.audioUrl, chinese, "zh-CN");
  }, [phase, current?.id, current?.back, current?.audioUrl]);

  const submitReview = async (rating: 1 | 3) => {
    if (!current) return;
    await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId: current.id,
        cardType: current.cardType ?? "default",
        rating,
      }),
    });
  };

  if (loading) {
    return <p className="text-center text-stone-500 py-12">Đang tải câu…</p>;
  }

  if (phase === "overview") {
    return (
      <AnkiDeckOverview
        title={title}
        section="sentence_order"
        stats={stats}
        mode={mode}
        onModeChange={onModeChange}
        onStudy={() => {
          if (cards.length === 0) return;
          setSessionCount(0);
          setIndex(0);
          setPhase("study");
        }}
      />
    );
  }

  if (phase === "finished" || !current) {
    return (
      <AnkiSessionFinished
        title={title}
        studied={sessionCount}
        onBack={() => setPhase("overview")}
        onContinue={() => {
          if (stats.queue > 0) {
            setSessionCount(0);
            setIndex(0);
            setPhase("study");
          } else void load();
        }}
      />
    );
  }

  const pick = (word: string, fromIndex: number) => {
    if (checked !== "idle") return;
    setPool((p) => p.filter((_, i) => i !== fromIndex));
    setPicked((p) => [...p, word]);
  };

  const unpick = (word: string, fromIndex: number) => {
    if (checked !== "idle") return;
    setPicked((p) => p.filter((_, i) => i !== fromIndex));
    setPool((p) => [...p, word]);
  };

  const check = async () => {
    const attempt = normalizeSentence(picked.join(""));
    const answer = normalizeSentence(current.back.split("\n")[0] ?? current.back);
    const ok = attempt === answer;
    setChecked(ok ? "ok" : "fail");
    await submitReview(ok ? 3 : 1);
  };

  const next = () => {
    setSessionCount((n) => n + 1);
    if (index + 1 >= cards.length) {
      setPhase("finished");
      void load();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const hint = current.pinyin;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <p className="text-sm text-stone-500 text-center">
        Câu {index + 1} / {cards.length} — Chọn từng mảnh theo đúng thứ tự
        {current.srs?.isNew && (
          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Mới</span>
        )}
      </p>

      <div className="min-h-[72px] rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-4 flex flex-wrap gap-2 justify-center">
        {picked.length === 0 ? (
          <span className="text-stone-400 text-sm">Câu của bạn sẽ hiện ở đây…</span>
        ) : (
          picked.map((w, i) => (
            <button
              key={`p-${i}-${w}`}
              type="button"
              onClick={() => unpick(w, i)}
              className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-lg"
            >
              {w}
            </button>
          ))
        )}
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {pool.map((w, i) => (
          <button
            key={`pool-${i}-${w}`}
            type="button"
            onClick={() => pick(w, i)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-lg hover:border-emerald-400"
          >
            {w}
          </button>
        ))}
      </div>

      {hint && <p className="text-center text-sm text-stone-500">Gợi ý: {hint}</p>}

      {checked === "ok" && (
        <p className="text-center text-emerald-700 font-medium">
          Đúng rồi! {current.back.includes("\n") ? current.back.split("\n").slice(1).join(" ") : ""}
        </p>
      )}
      {checked === "fail" && (
        <p className="text-center text-red-700 text-sm">
          Chưa đúng. Đáp án: <strong>{current.back.split("\n")[0]}</strong>
        </p>
      )}

      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={() => resetRound()}
          className="rounded-xl border border-stone-200 px-5 py-2.5 hover:bg-stone-50"
        >
          Trộn lại
        </button>
        <button
          type="button"
          onClick={() => void check()}
          disabled={picked.length === 0 || checked !== "idle"}
          className="rounded-xl bg-stone-900 px-5 py-2.5 text-white hover:bg-stone-800 disabled:opacity-40"
        >
          Kiểm tra
        </button>
        {checked !== "idle" && (
          <button
            type="button"
            onClick={next}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-white hover:bg-emerald-700"
          >
            Câu sau →
          </button>
        )}
      </div>
    </div>
  );
}

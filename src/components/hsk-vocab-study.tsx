"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  answersMatch,
  formatHints,
  hanziiSearchUrl,
  toHskCardView,
  type HskCardView,
} from "@/lib/hsk-card";
import {
  AnkiDeckOverview,
  AnkiSessionFinished,
  type DeckStats,
} from "@/components/anki-deck-overview";
import { previewIntervals } from "@/lib/srs";

const SECTION_UI: Record<
  "vocabulary" | "grammar" | "common",
  {
    defaultTitle: string;
    placeholder: string;
    inputLang?: string;
    showHanzii: boolean;
    badge: (level: string) => string;
  }
> = {
  vocabulary: {
    defaultTitle: "TỪ VỰNG HSK",
    placeholder: "Gõ chữ Hán...",
    inputLang: "zh-CN",
    showHanzii: true,
    badge: (level) => level || "HSK",
  },
  grammar: {
    defaultTitle: "NGỮ PHÁP",
    placeholder: "Gõ nghĩa tiếng Việt...",
    inputLang: "vi",
    showHanzii: false,
    badge: () => "NGỮ PHÁP",
  },
  common: {
    defaultTitle: "TIẾNG TRUNG THÔNG DỤNG",
    placeholder: "Gõ cụm tiếng Trung...",
    inputLang: "zh-CN",
    showHanzii: true,
    badge: () => "THÔNG DỤNG",
  },
};

type StudyCard = Parameters<typeof toHskCardView>[0];

type Props = {
  courseId: string;
  section: "vocabulary" | "grammar" | "common";
  mode: "review" | "all" | "new";
  onModeChange: (mode: "review" | "all" | "new") => void;
  onStats?: (stats: DeckStats) => void;
};

type Phase = "overview" | "study" | "finished";

export function HskVocabStudy({ courseId, section, mode, onModeChange, onStats }: Props) {
  const ui = SECTION_UI[section];
  const [title, setTitle] = useState(ui.defaultTitle);
  const [cards, setCards] = useState<HskCardView[]>([]);
  const [rawCards, setRawCards] = useState<StudyCard[]>([]);
  const [stats, setStats] = useState<DeckStats>({ new: 0, learning: 0, due: 0, queue: 0, total: 0 });
  const [phase, setPhase] = useState<Phase>("overview");
  const [index, setIndex] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const onStatsRef = useRef(onStats);
  onStatsRef.current = onStats;

  const load = useCallback(async () => {
    setLoading(true);
    setIndex(0);
    setTyped("");
    setRevealed(false);
    const res = await fetch(
      `/api/courses/${courseId}/study?section=${section}&mode=${mode}`,
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return;
    setTitle(data.title?.toUpperCase() ?? ui.defaultTitle);
    const mapped = (data.cards as StudyCard[]).map(toHskCardView);
    setRawCards(data.cards);
    setCards(mapped);
    const deckStats: DeckStats = {
      new: data.stats.new,
      learning: data.stats.learning,
      due: data.stats.due,
      queue: data.stats.queue,
      total: data.stats.total,
    };
    setStats(deckStats);
    onStatsRef.current?.(deckStats);
    setPhase("overview");
  }, [courseId, section, mode, ui.defaultTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  const startStudy = () => {
    if (cards.length === 0) return;
    setSessionCount(0);
    setIndex(0);
    setTyped("");
    setRevealed(false);
    setPhase("study");
  };

  const current = phase === "study" ? cards[index] : undefined;
  const currentRaw = phase === "study" ? rawCards[index] : undefined;

  const showAnswer = useCallback(() => setRevealed(true), []);

  const rate = async (rating: 1 | 2 | 3 | 4) => {
    if (!current || !currentRaw) return;
    const rated = current;
    const ratedRaw = currentRaw;
    const atIndex = index;
    const isLast = atIndex + 1 >= cards.length;

    setRevealed(false);
    setTyped("");
    setSessionCount((n) => n + 1);

    if (isLast) {
      setPhase("finished");
    } else {
      setIndex(atIndex + 1);
    }

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: rated.id,
          cardType: (ratedRaw as { cardType?: string }).cardType ?? "viet_trung",
          rating,
        }),
      });

      let data: { requeueInMs?: number | null } = {};
      if (res.ok) {
        data = await res.json();
      } else if (res.status === 401) {
        console.warn("[study] Phiên hết hạn — đăng nhập lại");
      } else {
        console.warn("[study] Lưu đánh giá thất bại");
      }

      const requeueMs = data.requeueInMs ?? null;
      if (requeueMs != null && requeueMs > 0 && requeueMs <= 15 * 60_000) {
        setTimeout(() => {
          setCards((prev) => [...prev, rated]);
          setRawCards((prev) => [...prev, ratedRaw]);
          setPhase("study");
        }, requeueMs);
      }

      if (isLast) {
        void load();
      }
    } catch (err) {
      console.warn("[study] Lưu đánh giá lỗi:", err);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== "study" || !current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement;
      const inTextField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (!revealed) {
        if (inTextField) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          showAnswer();
        }
        return;
      }

      if (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4") {
        e.preventDefault();
        void rate(Number(e.key) as 1 | 2 | 3 | 4);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, current, phase, index, cards.length, showAnswer]);

  if (loading) {
    return <p className="text-center text-stone-500 py-12">Đang tải thẻ…</p>;
  }

  if (phase === "overview") {
    return (
      <AnkiDeckOverview
        title={title}
        section={section}
        stats={stats}
        mode={mode}
        onModeChange={onModeChange}
        onStudy={startStudy}
      />
    );
  }

  if (phase === "finished") {
    return (
      <AnkiSessionFinished
        title={title}
        studied={sessionCount}
        onBack={() => setPhase("overview")}
        onContinue={() => {
          if (stats.queue > 0) startStudy();
          else setPhase("overview");
        }}
      />
    );
  }

  if (!current || !currentRaw) {
    return (
      <AnkiSessionFinished
        title={title}
        studied={sessionCount}
        onBack={() => setPhase("overview")}
        onContinue={() => void load()}
      />
    );
  }

  const hints = formatHints(current.hints);
  const correct = answersMatch(typed, current.answer);
  const intervals = previewIntervals(currentRaw.srs as Parameters<typeof previewIntervals>[0]);

  return (
    <div className="hsk-screen hsk-study-shell rounded-2xl overflow-hidden">
      {/* Header pill */}
      <div className="relative px-4 pt-6 pb-2">
        <div className="hsk-header-pill mx-auto max-w-md text-center py-2.5 px-6">
          {title}
        </div>
        <span className="hsk-level-badge absolute right-6 top-8">
          {ui.badge(current.hskLevel)}
        </span>
        {current.cardTypeLabel && current.cardType !== "viet_trung" && (
          <span className="absolute left-6 top-8 text-xs bg-white/80 px-2 py-1 rounded">
            {current.cardTypeLabel}
          </span>
        )}
      </div>

      {!revealed && (section !== "grammar" || current.imageUrl) && (
        <div className="hsk-study-image-wrap">
          {current.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.imageUrl} alt="" className="hsk-study-image" />
          ) : section !== "grammar" ? (
            <div className="w-40 h-40 rounded-lg bg-white/40 flex items-center justify-center text-stone-400 text-xs">
              Chưa có ảnh
            </div>
          ) : null}
        </div>
      )}

      {/* Main content */}
      <div className="mx-4 mb-4 space-y-3">
        {!revealed ? (
          <div className="hsk-question-card rounded-xl p-5 space-y-4">
            <div className="flex gap-3 items-start">
              <span className="text-pink-400 text-2xl font-bold leading-none">?</span>
              <div className={`hsk-hints flex-1 space-y-1 ${section === "grammar" ? "text-xl font-semibold" : "text-base"}`}>
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  showAnswer();
                }
              }}
              placeholder={ui.placeholder}
              className="hsk-input w-full rounded-lg px-4 py-3 text-lg text-center outline-none"
              autoFocus
              lang={ui.inputLang}
            />
          </div>
        ) : (
          <HskAnswerBack
            card={current}
            typed={typed}
            correct={correct}
            hints={hints}
            showHanzii={ui.showHanzii}
            isGrammar={section === "grammar"}
          />
        )}
      </div>

      {/* Stats + action */}
      <div className="px-4 pb-6 space-y-4">
        <p className="text-center text-sm">
          <span className="text-blue-600 font-medium">{stats.new}</span>
          <span className="text-stone-400 mx-1">+</span>
          <span className="text-red-500 font-medium">{stats.learning}</span>
          <span className="text-stone-400 mx-1">+</span>
          <span className="text-emerald-600 font-medium">{stats.due}</span>
        </p>

        {!revealed ? (
          <div className="flex justify-center">
            <button type="button" onClick={showAnswer} className="hsk-show-btn px-10 py-2.5">
              Hiện đáp án
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl mx-auto w-full">
            <RateBtn label="Again" sub={intervals.again} tone="red" hotkey="1" onClick={() => void rate(1)} />
            <RateBtn label="Hard" sub={intervals.hard} tone="amber" hotkey="2" onClick={() => void rate(2)} />
            <RateBtn label="Good" sub={intervals.good} tone="green" hotkey="3" onClick={() => void rate(3)} />
            <RateBtn label="Easy" sub={intervals.easy} tone="blue" hotkey="4" onClick={() => void rate(4)} />
          </div>
        )}

        <p className="text-center text-xs text-stone-500">
          {revealed ? "1–4 hoặc bấm nút để đánh giá" : "Gõ đáp án → Enter hoặc bấm Hiện đáp án"}
          {" · "}
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
  showHanzii = true,
  isGrammar = false,
}: {
  card: HskCardView;
  typed: string;
  correct: boolean;
  hints: string[];
  showHanzii?: boolean;
  isGrammar?: boolean;
}) {
  const showWrongCompare = !correct && typed.trim().length > 0;
  const mainDisplay = isGrammar ? "text-2xl leading-snug px-2" : "text-6xl";

  return (
    <div className="space-y-3">
      {/* Pinyin tag + wrong answer comparison */}
      <div className="relative flex flex-col items-center gap-2 pt-1">
        {showWrongCompare && (
          <div className="text-center space-y-1 mb-1">
            <p className={`font-medium text-red-700 ${isGrammar ? "text-lg" : "text-3xl"}`}>{typed}</p>
            <p className="text-stone-400 text-lg leading-none">↓</p>
          </div>
        )}
        {card.pinyin && (
          <span className="hsk-pinyin-badge">{card.pinyin}</span>
        )}
      </div>

      {/* Image */}
      <div className="hsk-study-image-wrap min-h-[180px] py-2">
        {card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt="" className="hsk-study-image bg-white/50" />
        ) : null}
      </div>

      {/* Large answer */}
      <div className="hsk-char-display w-full text-center py-4 px-6 rounded-xl bg-white/90 shadow-sm">
        <span className={`${mainDisplay} font-semibold text-stone-900`}>{card.answer}</span>
      </div>

      {/* Definition card */}
      <div className="hsk-answer-card rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-lg">
          <span className={`font-bold text-stone-900 ${isGrammar ? "text-lg" : "text-2xl"}`}>{card.answer}</span>
          {card.pinyin && (
            <span className="text-stone-600">/{card.pinyin}/</span>
          )}
          {card.audioUrl && <AudioBtn url={card.audioUrl} />}
        </div>
        {!isGrammar && (
          <div className="hsk-hints text-sm space-y-1">
            {hints.map((h, i) => (
              <p key={i}>
                {hints.length > 1 ? `${i + 1}. ` : ""}
                {h}
              </p>
            ))}
          </div>
        )}
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
      {showHanzii && (
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
      )}

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
  hotkey,
  onClick,
}: {
  label: string;
  sub: string;
  tone: "red" | "amber" | "green" | "blue";
  hotkey: string;
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
      <span className="block text-[10px] opacity-50 mt-0.5">{hotkey}</span>
    </button>
  );
}

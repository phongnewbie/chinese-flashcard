"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  answersMatch,
  hanziiSearchUrl,
  toHskCardView,
  type HskCardView,
} from "@/lib/hsk-card";
import {
  AnkiDeckOverview,
  AnkiSessionFinished,
  type DeckStats,
} from "@/components/anki-deck-overview";
import { renderCardTemplate, toCardFields } from "@/lib/card-template";
import { presetTemplatesForSection } from "@/lib/section-templates";
import type { CardTypeDef } from "@/lib/card-types";
import { previewIntervals } from "@/lib/srs";
import { playAudioOrTts, playAudioSequence } from "@/lib/anki-sound";

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

type StudyTemplates = {
  frontTemplate: string;
  backTemplate: string;
  cardCss: string;
};

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
  const [templates, setTemplates] = useState<StudyTemplates | null>(null);
  const [cardTypes, setCardTypes] = useState<CardTypeDef[]>([]);
  const shellRef = useRef<HTMLDivElement>(null);
  const cardContentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
    setTemplates(data.templates ?? null);
    setCardTypes(data.cardTypes ?? []);
    setPhase("overview");
  }, [courseId, section, mode, ui.defaultTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  const focusAnswerInput = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const startStudy = () => {
    if (cards.length === 0) return;
    setSessionCount(0);
    setIndex(0);
    setTyped("");
    setRevealed(false);
    setPhase("study");
    focusAnswerInput();
  };

  const current = phase === "study" ? cards[index] : undefined;
  const currentRaw = phase === "study" ? rawCards[index] : undefined;

  const currentCardType = useMemo(
    () => cardTypes.find((t) => t.id === currentRaw?.cardType) ?? null,
    [cardTypes, currentRaw?.cardType],
  );

  const templateFields = useMemo(
    () => (currentRaw ? toCardFields(currentRaw, currentCardType) : null),
    [currentRaw, currentCardType],
  );

  const activeTemplates = useMemo(() => {
    return templates ?? presetTemplatesForSection(section);
  }, [templates, section]);

  const frontHtml = useMemo(() => {
    if (!templateFields) return "";
    return renderCardTemplate(activeTemplates.frontTemplate, templateFields, "front");
  }, [activeTemplates, templateFields]);

  const backHtml = useMemo(() => {
    if (!templateFields) return "";
    return renderCardTemplate(activeTemplates.backTemplate, templateFields, "back");
  }, [activeTemplates, templateFields]);

  useEffect(() => {
    const el = cardContentRef.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest("[data-audio]") as HTMLElement | null;
      if (!btn) return;
      e.stopPropagation();
      e.preventDefault();
      void playAudioOrTts(btn.dataset.audio, btn.dataset.text);
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [revealed, currentRaw?.id, frontHtml, backHtml]);

  const showAnswer = useCallback(() => {
    setRevealed(true);
    requestAnimationFrame(() => shellRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!revealed || !current) return;
    void playAudioSequence([
      { audioUrl: current.audioUrl, text: current.answer, lang: "zh-CN" },
      {
        audioUrl: current.exampleAudioUrl,
        text: current.example?.chinese,
        lang: "zh-CN",
      },
    ]);
  }, [revealed, current?.id, current?.audioUrl, current?.answer, current?.exampleAudioUrl, current?.example?.chinese]);

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
      focusAnswerInput();
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

  const rateRef = useRef(rate);
  rateRef.current = rate;

  useEffect(() => {
    if (phase === "study" && !revealed && current) {
      focusAnswerInput();
    }
  }, [phase, revealed, current?.id, focusAnswerInput]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== "study" || !current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const inTextField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (!revealed) {
        if (e.key === "Enter" || (!inTextField && e.key === " ")) {
          e.preventDefault();
          showAnswer();
          return;
        }

        if (!inTextField) {
          if (e.key === "Backspace") {
            e.preventDefault();
            setTyped((prev) => prev.slice(0, -1));
            focusAnswerInput();
            return;
          }
          if (e.key === "Process" || e.key === "Compose") {
            focusAnswerInput();
            return;
          }
          if (e.key.length === 1) {
            e.preventDefault();
            setTyped((prev) => prev + e.key);
            focusAnswerInput();
          }
        }
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        void rateRef.current(3);
        return;
      }

      if (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4") {
        e.preventDefault();
        e.stopPropagation();
        void rateRef.current(Number(e.key) as 1 | 2 | 3 | 4);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [revealed, current, phase, showAnswer, focusAnswerInput]);

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

  const correct = answersMatch(typed, current.answer);
  const intervals = previewIntervals(currentRaw.srs as Parameters<typeof previewIntervals>[0]);

  return (
    <div
      ref={shellRef}
      tabIndex={-1}
      className="hsk-screen hsk-study-shell rounded-2xl overflow-hidden outline-none shrink-0 flex flex-col justify-between"
      onPointerDown={(e) => {
        if (!revealed && e.target === shellRef.current) {
          focusAnswerInput();
        }
      }}
    >
      {/* Header pill */}
      <div className="relative px-4 pt-5 pb-2 shrink-0">
        <div className="hsk-header-pill mx-auto max-w-md text-center py-2.5 px-6">
          {title}
        </div>
        <span className="hsk-level-badge absolute right-6 top-7">
          {ui.badge(current.hskLevel)}
        </span>
      </div>

      {/* Main card panel — render mẫu HTML từ 🎨 mẫu */}
      <div className="mx-4 shrink-0 flex justify-center">
        <style>{activeTemplates.cardCss}</style>
        <div
          className="study-card-panel rounded-2xl border-2 border-[#8fad8f] bg-white p-4 md:p-5 shadow-sm flex flex-col w-full max-w-[48rem] h-[520px] min-h-[520px] max-h-[520px] mx-auto overflow-hidden shrink-0"
          style={{ height: 520, minHeight: 520, maxHeight: 520, width: "100%", maxWidth: "48rem" }}
        >
          <div ref={cardContentRef} className="study-card-scroll flex-1 min-h-0 flex flex-col w-full h-full overflow-hidden">
            {!revealed ? (
              <div className="flex-1 min-h-0 w-full flex flex-col justify-between py-1">
                <div
                  className="anki-card-content flex-1 min-h-0 w-full text-left overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: frontHtml }}
                />
                <div className="max-w-md mx-auto w-full pt-2 shrink-0">
                  <input
                    ref={inputRef}
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
                    className="hsk-input w-full rounded-xl px-4 py-3 text-xl text-center outline-none font-medium shadow-inner"
                    autoFocus
                    lang={ui.inputLang}
                  />
                </div>
              </div>
            ) : (
              <HskAnswerBack
                card={current}
                typed={typed}
                correct={correct}
                backHtml={backHtml}
                showHanzii={ui.showHanzii}
              />
            )}
          </div>
        </div>
      </div>

      {/* Nút hành động — vùng cao cố định */}
      <div className="study-action-bar shrink-0 px-4 pb-5 space-y-2">
        {!revealed ? (
          <div className="flex justify-center">
            <button type="button" onClick={showAnswer} className="hsk-show-btn px-10 py-2.5 text-base">
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
          {revealed ? "Enter/Space = Good · 1–4 đánh giá" : "Gõ đáp án → Enter hoặc bấm Hiện đáp án"}
          {" · "}
          {index + 1} / {cards.length}
          {current.cardTypeLabel &&
            current.cardType !== "viet_trung" &&
            current.cardType !== "trung_viet" && (
            <span className="text-stone-400"> · {current.cardTypeLabel}</span>
          )}
        </p>
      </div>
    </div>
  );
}

function HskAnswerBack({
  card,
  typed,
  correct,
  backHtml,
  showHanzii = true,
}: {
  card: HskCardView;
  typed: string;
  correct: boolean;
  backHtml: string;
  showHanzii?: boolean;
}) {
  const showWrongCompare = !correct && typed.trim().length > 0;

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col py-1">
      {showWrongCompare && (
        <div className="text-center space-y-1 pb-2 shrink-0">
          <p className="font-medium text-red-700 text-lg md:text-xl">{typed}</p>
          <p className="text-stone-400 text-lg leading-none">↓</p>
        </div>
      )}
      <div
        className="anki-card-content flex-1 min-h-0 w-full text-left overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: backHtml }}
      />
      {(showHanzii || correct) && (
        <div className="pt-3 shrink-0 flex flex-col items-center gap-1.5">
          {showHanzii && (
            <a
              href={hanziiSearchUrl(card.answer)}
              target="_blank"
              rel="noopener noreferrer"
              className="hsk-hanzii-btn inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold"
            >
              <span aria-hidden>🔍</span> Tra từ điển Hanzii
            </a>
          )}
          {correct && (
            <p className="text-center text-sm md:text-base text-emerald-700 font-semibold">✓ Chính xác!</p>
          )}
        </div>
      )}
    </div>
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

"use client";



import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {

  AnkiDeckOverview,

  AnkiSessionFinished,

  type DeckStats,

} from "@/components/anki-deck-overview";

import {

  renderCardTemplate,

  resolveCardTypeTemplates,

  toCardFields,

  type TemplateFields,

} from "@/lib/card-template";
import type { CardTypeDef } from "@/lib/card-types";
import { resolveSoundPlayUrl } from "@/lib/anki-sound";

import { sectionLabel, type StudySectionId } from "@/lib/sections";

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

  section: StudySectionId;

  mode: "review" | "all" | "new";

  onModeChange: (mode: "review" | "all" | "new") => void;

  onStats?: (stats: DeckStats) => void;

};



type Phase = "overview" | "study" | "finished";



export function AnkiStudy({ courseId, section, mode, onModeChange, onStats }: Props) {

  const [cards, setCards] = useState<StudyCard[]>([]);

  const [templates, setTemplates] = useState<Templates | null>(null);

  const [cardTypes, setCardTypes] = useState<CardTypeDef[]>([]);

  const [title, setTitle] = useState("");

  const [stats, setStats] = useState<DeckStats>({ new: 0, learning: 0, due: 0, queue: 0, total: 0 });

  const [phase, setPhase] = useState<Phase>("overview");

  const [index, setIndex] = useState(0);

  const [sessionCount, setSessionCount] = useState(0);

  const [flipped, setFlipped] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const studyRef = useRef<HTMLDivElement>(null);
  const ratingLockRef = useRef(false);

  const onStatsRef = useRef(onStats);
  const rateRef = useRef<(rating: 1 | 2 | 3 | 4) => Promise<void>>(async () => {});

  onStatsRef.current = onStats;



  const load = useCallback(async () => {

    setLoading(true);
    setLoadError(null);

    setIndex(0);

    setFlipped(false);

    const res = await fetch(

      `/api/courses/${courseId}/study?section=${section}&mode=${mode}`,

    );

    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setLoadError(
        data.error === "Forbidden"
          ? "Không có quyền mở bộ thẻ này. Liên hệ admin nếu bạn chưa được gán cấp HSK."
          : data.error === "locked"
            ? "Tài khoản đang bị khóa học thử."
            : typeof data.error === "string"
              ? data.error
              : "Không tải được thẻ. Thử tải lại trang.",
      );
      return;
    }

    const deckStats: DeckStats = {

      new: data.stats.new,

      learning: data.stats.learning,

      due: data.stats.due,

      queue: data.stats.queue,

      total: data.stats.total,

    };

    setStats(deckStats);

    onStatsRef.current?.(deckStats);

    setCards(data.cards ?? []);

    setTemplates(data.templates ?? null);

    setCardTypes(data.cardTypes ?? []);

    setTitle(data.title ?? sectionLabel(section));

    setPhase("overview");

  }, [courseId, section, mode]);

  const refreshDeck = useCallback(async () => {
    const res = await fetch(
      `/api/courses/${courseId}/study?section=${section}&mode=${mode}`,
    );
    const data = await res.json();
    if (!res.ok) return;

    const deckStats: DeckStats = {
      new: data.stats.new,
      learning: data.stats.learning,
      due: data.stats.due,
      queue: data.stats.queue,
      total: data.stats.total,
    };
    setStats(deckStats);
    onStatsRef.current?.(deckStats);
    setCards(data.cards ?? []);
    setTemplates(data.templates ?? null);
    setCardTypes(data.cardTypes ?? []);
    setTitle(data.title ?? sectionLabel(section));
  }, [courseId, section, mode]);



  useEffect(() => {

    void load();

  }, [load]);



  const focusStudy = () => {
    requestAnimationFrame(() => studyRef.current?.focus());
  };

  const startStudy = () => {

    if (cards.length === 0) return;

    setSessionCount(0);

    setIndex(0);

    setFlipped(false);

    setPhase("study");
    focusStudy();

  };



  const current = phase === "study" ? cards[index] : undefined;



  const currentCardType = useMemo(

    () => cardTypes.find((t) => t.id === current?.cardType) ?? null,

    [cardTypes, current?.cardType],

  );



  const activeTemplates = useMemo(

    () =>

      templates && currentCardType

        ? resolveCardTypeTemplates(templates, currentCardType)

        : templates,

    [templates, currentCardType],

  );



  const fields: TemplateFields | null = useMemo(

    () => (current ? toCardFields(current, currentCardType) : null),

    [current, currentCardType],

  );



  const intervals = useMemo(

    () => (current ? previewIntervals(current.srs) : null),

    [current],

  );



  const playAudio = (url: string) => {
    const resolved = resolveSoundPlayUrl(url);
    const audio = new Audio(resolved);
    void audio.play().catch(() => {
      console.warn("[audio] Không phát được:", resolved);
    });
  };



  const rate = useCallback(async (rating: 1 | 2 | 3 | 4) => {

    if (!current || phase !== "study" || ratingLockRef.current) return;

    ratingLockRef.current = true;

    const rated = current;
    const atIndex = index;
    const isLast = atIndex + 1 >= cards.length;

    setFlipped(false);
    setSessionCount((n) => n + 1);

    if (isLast) {
      setPhase("finished");
    } else {
      setIndex(atIndex + 1);
      focusStudy();
    }

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: rated.id, cardType: rated.cardType, rating }),
      });

      const data = res.ok ? await res.json() : {};
      if (!res.ok) {
        console.warn("[study] Lưu đánh giá thất bại:", data);
      }

      const requeueMs = data.requeueInMs as number | null;
      if (requeueMs != null && requeueMs > 0 && requeueMs <= 15 * 60_000) {
        setTimeout(() => {
          setCards((prev) => {
            if (prev.some((c) => c.id === rated.id && c.cardType === rated.cardType)) {
              return prev;
            }
            return [...prev, rated];
          });
          setPhase("study");
          focusStudy();
        }, requeueMs);
      }

      if (isLast) {
        void refreshDeck();
      }
    } catch (err) {
      console.warn("[study] Lưu đánh giá lỗi:", err);
    } finally {
      ratingLockRef.current = false;
    }

  }, [current, index, cards.length, phase, refreshDeck]);

  rateRef.current = rate;

  const handleStudyKeyDown = (e: React.KeyboardEvent) => {

    if (phase !== "study" || !current) return;

    if (e.repeat) return;

    const target = e.target as HTMLElement | null;

    const tag = target?.tagName;

    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (target?.isContentEditable) return;



    if (e.key === "Enter" || e.key === " ") {

      e.preventDefault();

      e.stopPropagation();

      if (flipped) void rateRef.current(3);

      else setFlipped(true);

      return;

    }



    if (flipped) {

      if (e.key === "1") void rateRef.current(1);

      else if (e.key === "2") void rateRef.current(2);

      else if (e.key === "3") void rateRef.current(3);

      else if (e.key === "4") void rateRef.current(4);

    }

  };



  useEffect(() => {

    const el = cardRef.current;

    if (!el) return;

    const onClick = (e: MouseEvent) => {

      const t = e.target as HTMLElement;

      const btn = t.closest("[data-audio]") as HTMLElement | null;

      if (btn?.dataset.audio) {

        e.stopPropagation();

        e.preventDefault();

        playAudio(btn.dataset.audio);

      }

    };

    el.addEventListener("click", onClick);

    return () => el.removeEventListener("click", onClick);

  }, [flipped, current?.id]);



  useEffect(() => {

    if (phase === "study") focusStudy();

  }, [phase, index]);



  if (loading) {

    return <p className="text-stone-500 text-center py-12">Đang tải thẻ…</p>;

  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center space-y-3">
        <p className="text-red-800 font-medium">{loadError}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-white border border-red-200 px-4 py-2 text-sm hover:bg-red-100"
        >
          Thử lại
        </button>
      </div>
    );
  }



  if (phase === "overview") {

    return (

      <AnkiDeckOverview

        title={title.toUpperCase()}

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

        title={title.toUpperCase()}

        studied={sessionCount}

        onBack={() => setPhase("overview")}

        onContinue={() => {

          if (stats.queue > 0) startStudy();

          else setPhase("overview");

        }}

      />

    );

  }



  if (!current || !activeTemplates || !fields) {

    return (

      <AnkiSessionFinished

        title={title.toUpperCase()}

        studied={sessionCount}

        onBack={() => setPhase("overview")}

        onContinue={() => void load()}

      />

    );

  }



  const html = flipped

    ? renderCardTemplate(activeTemplates.backTemplate, fields, "back")

    : renderCardTemplate(activeTemplates.frontTemplate, fields, "front");



  return (

    <div
      ref={studyRef}
      tabIndex={-1}
      onKeyDown={handleStudyKeyDown}
      className="hsk-screen hsk-study-shell rounded-2xl overflow-hidden outline-none"
    >

      <div className="relative px-4 pt-6 pb-2">

        <div className="hsk-header-pill mx-auto max-w-md text-center py-2.5 px-6">

          {title.toUpperCase()}

        </div>

        {current.cardTypeLabel && current.cardType !== "default" && (

          <span className="absolute left-6 top-8 text-xs bg-white/80 px-2 py-1 rounded">

            {current.cardTypeLabel}

          </span>

        )}

      </div>



      <div className="px-4 pb-2 flex items-center justify-between text-sm text-stone-600">

        <span>

          {index + 1} / {cards.length}

          {current.srs.isNew && (

            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Mới</span>

          )}

        </span>

        {current.audioUrl && (

          <button

            type="button"

            onClick={(e) => {

              e.stopPropagation();

              playAudio(current.audioUrl!);

            }}

            className="text-emerald-800 text-xs hover:underline"

          >

            🔊 Nghe

          </button>

        )}

      </div>



      <div className="mx-4 mb-4">

        <style>{activeTemplates.cardCss}</style>

        <div

          onClick={(e) => {

            if ((e.target as HTMLElement).closest(".audio-btn, [data-audio]")) return;

            if (!flipped) setFlipped(true);

          }}

          className="anki-card-shell w-full rounded-xl border-2 border-[#8fad8f] bg-white p-4 shadow-sm text-left transition hover:border-emerald-400 cursor-pointer"

        >

          <div

            ref={cardRef}

            className="anki-card-content"

            dangerouslySetInnerHTML={{ __html: html }}

          />

        </div>

      </div>



      <div className="px-4 pb-6 space-y-3">

        <p className="text-center text-sm">

          <span className="text-blue-600 font-medium">{stats.new}</span>

          <span className="text-stone-400 mx-1">+</span>

          <span className="text-red-500 font-medium">{stats.learning}</span>

          <span className="text-stone-400 mx-1">+</span>

          <span className="text-emerald-600 font-medium">{stats.due}</span>

        </p>



        {!flipped ? (

          <div className="flex justify-center">

            <button

              type="button"

              onClick={() => setFlipped(true)}

              className="hsk-show-btn px-10 py-2.5"

            >

              Hiện đáp án

            </button>

          </div>

        ) : (

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl mx-auto w-full">

            <RateBtn label="Again" sub={intervals?.again} color="red" onClick={() => void rate(1)} hotkey="1" />

            <RateBtn label="Hard" sub={intervals?.hard} color="amber" onClick={() => void rate(2)} hotkey="2" />

            <RateBtn label="Good" sub={intervals?.good} color="green" onClick={() => void rate(3)} hotkey="3" />

            <RateBtn label="Easy" sub={intervals?.easy} color="blue" onClick={() => void rate(4)} hotkey="4" />

          </div>

        )}



        <p className="text-center text-xs text-stone-500">

          {flipped ? "Enter / Space = Good · 1–4 đánh giá" : "Enter / Space — lật thẻ · bấm Hiện đáp án"}

        </p>

      </div>

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

  color: "red" | "amber" | "green" | "blue";

  onClick: () => void;

  hotkey: string;

}) {

  const colors = {

    red: "bg-red-100 border-red-200 text-red-900 hover:bg-red-200",

    amber: "bg-amber-100 border-amber-200 text-amber-900 hover:bg-amber-200",

    green: "bg-emerald-100 border-emerald-200 text-emerald-900 hover:bg-emerald-200",

    blue: "bg-blue-100 border-blue-200 text-blue-900 hover:bg-blue-200",

  };

  return (

    <button

      type="button"

      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}

      className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${colors[color]}`}

    >

      <span className="block">{label}</span>

      <span className="block text-[10px] opacity-70">{sub}</span>

      <span className="block text-[10px] opacity-50 mt-0.5">{hotkey}</span>

    </button>

  );

}



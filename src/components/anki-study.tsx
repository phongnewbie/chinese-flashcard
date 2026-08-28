"use client";



import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {

  AnkiDeckOverview,

  AnkiSessionFinished,

  type DeckStats,

} from "@/components/anki-deck-overview";

import {

  renderCardTemplate,

  toCardFields,

  type TemplateFields,

} from "@/lib/card-template";
import { resolveAudioUrl } from "@/lib/import-cards";

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

  const [title, setTitle] = useState("");

  const [stats, setStats] = useState<DeckStats>({ new: 0, learning: 0, due: 0, queue: 0, total: 0 });

  const [phase, setPhase] = useState<Phase>("overview");

  const [index, setIndex] = useState(0);

  const [sessionCount, setSessionCount] = useState(0);

  const [flipped, setFlipped] = useState(false);

  const [loading, setLoading] = useState(true);

  const cardRef = useRef<HTMLDivElement>(null);

  const onStatsRef = useRef(onStats);

  onStatsRef.current = onStats;



  const load = useCallback(async () => {

    setLoading(true);

    setIndex(0);

    setFlipped(false);

    const res = await fetch(

      `/api/courses/${courseId}/study?section=${section}&mode=${mode}`,

    );

    const data = await res.json();

    setLoading(false);

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

    setTitle(data.title ?? sectionLabel(section));

    setPhase("overview");

  }, [courseId, section, mode]);



  useEffect(() => {

    void load();

  }, [load]);



  const startStudy = () => {

    if (cards.length === 0) return;

    setSessionCount(0);

    setIndex(0);

    setFlipped(false);

    setPhase("study");

  };



  const current = phase === "study" ? cards[index] : undefined;



  const fields: TemplateFields | null = useMemo(

    () => (current ? toCardFields(current) : null),

    [current],

  );



  const intervals = useMemo(

    () => (current ? previewIntervals(current.srs) : null),

    [current],

  );



  const playAudio = (url: string) => {
    const resolved = resolveAudioUrl(url, "/uploads/audio") ?? url;
    void new Audio(resolved).play();
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

    setSessionCount((n) => n + 1);

    const requeueMs = data.requeueInMs as number | null;

    if (requeueMs != null && requeueMs > 0 && requeueMs <= 15 * 60_000) {

      setTimeout(() => {

        setCards((prev) => {

          if (prev.some((c) => c.id === current.id && c.cardType === current.cardType && index < prev.length)) {

            return prev;

          }

          return [...prev, current];

        });

        setPhase("study");

      }, requeueMs);

    }

    if (index + 1 >= cards.length) {

      setPhase("finished");

      void load();

    } else {

      setIndex((i) => i + 1);

    }

  };



  useEffect(() => {

    const onKey = (e: KeyboardEvent) => {

      if (phase !== "study" || !current) return;

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

  }, [flipped, current, phase, index, cards.length]);



  if (loading) {

    return <p className="text-stone-500 text-center py-12">Đang tải thẻ…</p>;

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



  if (!current || !templates || !fields) {

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

    ? renderCardTemplate(templates.backTemplate, fields, "back")

    : renderCardTemplate(templates.frontTemplate, fields, "front");



  return (

    <div className="hsk-screen rounded-2xl overflow-hidden mx-auto max-w-xl">

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

        {!flipped && current.audioUrl && (

          <button

            type="button"

            onClick={() => playAudio(current.audioUrl!)}

            className="text-emerald-800 text-xs hover:underline"

          >

            🔊 Nghe

          </button>

        )}

      </div>



      <div className="mx-4 mb-4">

        <style>{templates.cardCss}</style>

        <button

          type="button"

          onClick={() => !flipped && setFlipped(true)}

          className="w-full min-h-[280px] rounded-xl border-2 border-[#8fad8f] bg-white p-4 shadow-sm text-left transition hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"

        >

          <div

            ref={cardRef}

            className="anki-card-content"

            dangerouslySetInnerHTML={{ __html: html }}

          />

        </button>

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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-lg mx-auto">

            <RateBtn label="Again" sub={intervals?.again} color="red" onClick={() => void rate(1)} hotkey="1" />

            <RateBtn label="Hard" sub={intervals?.hard} color="amber" onClick={() => void rate(2)} hotkey="2" />

            <RateBtn label="Good" sub={intervals?.good} color="green" onClick={() => void rate(3)} hotkey="3" />

            <RateBtn label="Easy" sub={intervals?.easy} color="blue" onClick={() => void rate(4)} hotkey="4" />

          </div>

        )}



        <p className="text-center text-xs text-stone-500">

          {flipped ? "1–4 hoặc bấm nút để đánh giá" : "Enter / Space — lật thẻ · bấm Hiện đáp án"}

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

      onClick={onClick}

      className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${colors[color]}`}

    >

      <span className="block">{label}</span>

      <span className="block text-[10px] opacity-70">{sub}</span>

      <span className="block text-[10px] opacity-50 mt-0.5">{hotkey}</span>

    </button>

  );

}



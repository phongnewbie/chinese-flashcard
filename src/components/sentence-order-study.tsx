"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AnkiDeckOverview,
  AnkiSessionFinished,
  type DeckStats,
} from "@/components/anki-deck-overview";
import { htmlHasSlot, TemplateSlots } from "@/components/template-slots";
import { playAudioOrTts } from "@/lib/anki-sound";
import { renderCardTemplate, toCardFields } from "@/lib/card-template";
import { presetTemplatesForSection } from "@/lib/section-templates";

type Card = {
  id: string;
  front: string;
  back: string;
  pinyin: string | null;
  audioUrl?: string | null;
  extraFields?: string | null;
  section?: string;
  cardType?: string;
  srs?: { isNew?: boolean; intervalDays?: number };
};

type Templates = {
  frontTemplate: string;
  backTemplate: string;
  cardCss: string;
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
  const [templates, setTemplates] = useState<Templates | null>(null);
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
    setTemplates(data.templates ?? null);
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

  const [hintOpen, setHintOpen] = useState(false);

  const resetRound = useCallback(
    (shuffled?: string[]) => {
      const base = shuffled ?? [...parts].sort(() => Math.random() - 0.5);
      setPool(base);
      setPicked([]);
      setChecked("idle");
      setHintOpen(false);
    },
    [parts],
  );

  useEffect(() => {
    if (current) resetRound();
  }, [current?.id, resetRound]);

  const playSentenceAudio = useCallback(() => {
    if (!current) return;
    const chinese = (current.back.split("\n")[0] ?? current.back).trim();
    if (!chinese) return;
    void playAudioOrTts(current.audioUrl, chinese, "zh-CN");
  }, [current]);

  useEffect(() => {
    if (phase !== "study" || !current) return;
    playSentenceAudio();
  }, [phase, current?.id, playSentenceAudio]);

  const activeTemplates = templates ?? presetTemplatesForSection("sentence_order");
  const fields = useMemo(
    () => (current ? toCardFields({ ...current, section: "sentence_order", audioUrl: current.audioUrl ?? null }) : null),
    [current],
  );

  const grammarStructure = useMemo(() => {
    if (!fields) return "";
    return (
      fields["CẤU TRÚC NGỮ PHÁP"] ||
      fields["CẤU TRÚC"] ||
      fields["Cấu trúc ngữ pháp"] ||
      fields["Cấu trúc"] ||
      fields["ĐIỂM NGỮ PHÁP"] ||
      fields["Điểm ngữ pháp"] ||
      fields["GHI CHÚ"] ||
      fields["Ghi chú"] ||
      fields["NGHĨA"] ||
      fields["Nghĩa"] ||
      ""
    );
  }, [fields]);

  const frontHtml = useMemo(() => {
    if (!fields) return "";
    return renderCardTemplate(activeTemplates.frontTemplate, fields, "front");
  }, [activeTemplates, fields]);
  const backHtml = useMemo(() => {
    if (!fields) return "";
    return renderCardTemplate(activeTemplates.backTemplate, fields, "back");
  }, [activeTemplates, fields]);

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
    setHintOpen(false);
    setSessionCount((n) => n + 1);
    if (index + 1 >= cards.length) {
      setPhase("finished");
      void load();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const answerBox = (
    <div className="min-h-[72px] w-full rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-4 flex flex-wrap gap-2 justify-center">
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
  );

  const pieces = (
    <div className="flex flex-wrap gap-2 justify-center w-full py-2">
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
  );

  const showTemplateSlots =
    htmlHasSlot(frontHtml, "STUDY_PIECES") || htmlHasSlot(frontHtml, "STUDY_ANSWER_BOX");

  return (
    <div
      className="hsk-screen hsk-study-shell rounded-2xl overflow-hidden flex flex-col justify-between"
      style={{ height: 740, minHeight: 740, maxHeight: 740, width: "100%", maxWidth: "58rem" }}
    >
      <div className="relative px-4 pt-5 pb-2 shrink-0">
        <div className="hsk-header-pill mx-auto max-w-md text-center py-2.5 px-6">{title}</div>
      </div>
      <p className="text-sm text-stone-500 text-center shrink-0 pb-1">
        {index + 1} / {cards.length}
      </p>

      <div className="mx-4 shrink-0 flex justify-center">
        <style>{activeTemplates.cardCss}</style>
        <div
          className="study-card-panel rounded-2xl border-2 border-[#8fad8f] bg-white p-4 md:p-5 shadow-sm flex flex-col w-full max-w-[48rem] h-[520px] min-h-[520px] max-h-[520px] mx-auto overflow-hidden shrink-0"
          style={{ height: 520, minHeight: 520, maxHeight: 520, width: "100%", maxWidth: "48rem" }}
        >
          <div className="anki-card-content flex-1 min-h-0 w-full text-left overflow-y-auto space-y-3">
            {checked !== "idle" ? (
              <div dangerouslySetInnerHTML={{ __html: backHtml }} />
            ) : showTemplateSlots ? (
              <TemplateSlots
                html={frontHtml}
                slots={{
                  STUDY_ANSWER_BOX: answerBox,
                  STUDY_PIECES: pieces,
                }}
              />
            ) : (
              <div className="space-y-4">
                {answerBox}
                {pieces}
              </div>
            )}

            {/* Khối gợi ý cấu trúc ngữ pháp khi bấm nút Gợi ý */}
            {hintOpen && (
              <div className="mx-auto max-w-lg w-full rounded-xl bg-amber-50 border border-amber-300 p-3.5 text-center shadow-sm animate-fadeIn">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">💡 Cấu trúc ngữ pháp</p>
                <p className="text-sm text-stone-800 mt-1 font-medium leading-relaxed">
                  {grammarStructure || "Không có thông tin cấu trúc cho câu này"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vùng trạng thái kết quả có chiều cao cố định */}
      <div className="h-6 shrink-0 flex items-center justify-center px-4">
        {checked === "ok" && (
          <p className="text-center text-emerald-700 font-semibold text-sm">✓ Đúng rồi!</p>
        )}
        {checked === "fail" && (
          <p className="text-center text-red-700 text-sm font-medium">
            Chưa đúng. Đáp án: <strong>{current.back.split("\n")[0]}</strong>
          </p>
        )}
      </div>

      <div
        className="study-action-bar shrink-0 px-4 pb-5 flex flex-wrap gap-2.5 justify-center items-center"
        style={{ height: 110, minHeight: 110, maxHeight: 110 }}
      >
        <button
          type="button"
          onClick={playSentenceAudio}
          className="rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 px-4 py-2.5 text-sm font-medium hover:bg-emerald-100 flex items-center gap-1.5 transition shadow-sm"
          title="Nghe phát âm câu tiếng Trung"
        >
          <span>🔊</span> Âm thanh
        </button>
        <button
          type="button"
          onClick={() => setHintOpen((prev) => !prev)}
          className={`rounded-xl border px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 transition shadow-sm ${
            hintOpen
              ? "border-amber-400 bg-amber-100 text-amber-900"
              : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
          }`}
          title="Xem gợi ý cấu trúc ngữ pháp"
        >
          <span>💡</span> Gợi ý
        </button>
        <button
          type="button"
          onClick={() => resetRound()}
          className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm hover:bg-stone-50 text-stone-700 transition"
        >
          Trộn lại
        </button>
        <button
          type="button"
          onClick={() => void check()}
          disabled={picked.length === 0 || checked !== "idle"}
          className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40 transition shadow-sm"
        >
          Kiểm tra
        </button>
        {checked !== "idle" && (
          <button
            type="button"
            onClick={next}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition shadow-sm"
          >
            Câu sau →
          </button>
        )}
      </div>
    </div>
  );
}

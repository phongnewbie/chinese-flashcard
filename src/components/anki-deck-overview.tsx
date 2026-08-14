"use client";

import { sectionLabel, type StudySectionId } from "@/lib/sections";

export type DeckStats = {
  new: number;
  learning: number;
  due: number;
  queue: number;
  total?: number;
};

type StudyMode = "review" | "new" | "all";

type Props = {
  title: string;
  section: StudySectionId;
  stats: DeckStats;
  mode: StudyMode;
  onModeChange: (mode: StudyMode) => void;
  onStudy: () => void;
};

const MODES: { id: StudyMode; label: string; hint: string }[] = [
  { id: "review", label: "Ôn SRS", hint: "Giống Study Now trên Anki" },
  { id: "new", label: "Chỉ thẻ mới", hint: "Custom study — thẻ chưa học" },
  { id: "all", label: "Học tất cả", hint: "Custom study — mọi thẻ" },
];

export function AnkiDeckOverview({
  title,
  section,
  stats,
  mode,
  onModeChange,
  onStudy,
}: Props) {
  const canStudy = stats.queue > 0;
  const sectionName = sectionLabel(section);

  return (
    <div className="anki-deck-screen rounded-2xl overflow-hidden">
      <div className="px-4 pt-6 pb-3">
        <div className="hsk-header-pill mx-auto max-w-md text-center py-2.5 px-6">
          {title || sectionName}
        </div>
      </div>

      <div className="mx-4 mb-4 rounded-xl bg-white/90 border border-stone-200 shadow-sm p-6 space-y-6">
        <div className="text-center space-y-1">
          <p className="text-sm text-stone-500">{sectionName}</p>
          <p className="text-xs text-stone-400">Tổng thẻ: {stats.total ?? stats.new + stats.learning + stats.due}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <CountPill label="Mới" value={stats.new} tone="blue" />
          <CountPill label="Đang học" value={stats.learning} tone="red" />
          <CountPill label="Ôn tập" value={stats.due} tone="green" />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.hint}
              onClick={() => onModeChange(m.id)}
              className={`rounded-lg px-3 py-1.5 text-xs border transition ${
                mode === m.id
                  ? "bg-stone-800 text-white border-stone-800"
                  : "bg-white border-stone-200 text-stone-600 hover:border-stone-300"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3 pt-2">
          <button
            type="button"
            disabled={!canStudy}
            onClick={onStudy}
            className={`anki-study-now-btn px-10 py-3 text-base font-semibold rounded-xl transition ${
              canStudy
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                : "bg-stone-200 text-stone-400 cursor-not-allowed"
            }`}
          >
            Học ngay
          </button>

          {!canStudy ? (
            <div className="text-center space-y-2 max-w-sm">
              <p className="text-base font-medium text-stone-800">
                Chúc mừng! Bạn đã xong bộ thẻ này.
              </p>
              <p className="text-sm text-stone-500">
                {stats.new > 0 && mode === "review"
                  ? "Có thẻ mới nhưng chưa đến lượt trong chế độ Ôn SRS. Thử “Chỉ thẻ mới” hoặc quay lại sau."
                  : stats.total === 0
                    ? "Chưa có thẻ trong mục này. Vào Quản trị → Browse để thêm hoặc import."
                    : "Không còn thẻ trong hàng đợi. Quay lại sau hoặc chọn chế độ học khác."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-stone-500">
              {stats.queue} thẻ sẵn sàng · {mode === "review" ? "Ôn SRS" : mode === "new" ? "Thẻ mới" : "Tất cả"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CountPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "red" | "green";
}) {
  const colors = {
    blue: "text-blue-600",
    red: "text-red-600",
    green: "text-emerald-600",
  };
  return (
    <div className="rounded-lg bg-stone-50 border border-stone-100 py-3 px-2">
      <p className={`text-2xl font-bold tabular-nums ${colors[tone]}`}>{value}</p>
      <p className="text-xs text-stone-500 mt-1">{label}</p>
    </div>
  );
}

export function AnkiSessionFinished({
  title,
  studied,
  onBack,
  onContinue,
}: {
  title: string;
  studied: number;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="anki-deck-screen rounded-2xl overflow-hidden p-8 text-center space-y-5">
      <div className="hsk-header-pill mx-auto max-w-md py-2.5 px-6">{title}</div>
      <div className="mx-auto max-w-sm space-y-3">
        <p className="text-xl font-semibold text-stone-800">Chúc mừng!</p>
        <p className="text-stone-600">
          {studied > 0
            ? `Bạn vừa học xong ${studied} thẻ trong phiên này.`
            : "Phiên học đã kết thúc."}
        </p>
        <p className="text-sm text-stone-500">Quay lại màn deck hoặc học tiếp nếu còn thẻ.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-stone-300 bg-white px-6 py-2.5 text-sm font-medium hover:bg-stone-50"
        >
          Về màn deck
        </button>
        <button type="button" onClick={onContinue} className="hsk-show-btn px-8 py-2.5">
          Học tiếp
        </button>
      </div>
    </div>
  );
}

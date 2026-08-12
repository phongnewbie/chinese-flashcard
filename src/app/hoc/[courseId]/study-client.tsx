"use client";

import Link from "next/link";
import { useState } from "react";
import { HskVocabStudy } from "@/components/hsk-vocab-study";
import { AnkiStudy } from "@/components/anki-study";
import { SentenceOrderStudy } from "@/components/sentence-order-study";
import { LockScreen, TrialBanner, useAccess } from "@/components/access-ui";
import { STUDY_SECTIONS, type StudySectionId } from "@/lib/sections";

type StudyMode = "review" | "all" | "new";

export function StudyClient({ courseId }: { courseId: string }) {
  const { access, loading: accessLoading } = useAccess();
  const [section, setSection] = useState<StudySectionId>("vocabulary");
  const [mode, setMode] = useState<StudyMode>("review");
  const [stats, setStats] = useState({ due: 0, new: 0, queue: 0, learning: 0 });

  if (accessLoading) return <p className="text-stone-500">Đang tải...</p>;
  if (access && !access.allowed) return <LockScreen access={access} />;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/hoc" className="text-sm text-stone-500 hover:text-stone-800">
          ← Khóa học
        </Link>
        <h1 className="text-xl font-bold text-stone-900 mt-1">Ôn tập kiểu Anki</h1>
      </div>
      <TrialBanner />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STUDY_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
              section === s.id
                ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                : "border-stone-200 bg-white hover:border-stone-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
          {(
            [
              ["review", "Ôn SRS (Anki)"],
              ["new", "Chỉ thẻ mới"],
              ["all", "Học tất cả"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-sm border ${
                mode === m
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white border-stone-200"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="text-xs text-stone-500 ml-auto">
            Mới: {stats.new} · Ôn: {stats.due} · Đang học: {stats.learning}
          </span>
        </div>

      <StudyStatsPanel />

      {section === "sentence_order" ? (
        <SentenceOrderStudy courseId={courseId} mode={mode} />
      ) : section === "vocabulary" ? (
        <HskVocabStudy
          key={`hsk-${mode}`}
          courseId={courseId}
          mode={mode}
          onStats={setStats}
        />
      ) : (
        <AnkiStudy
          key={`${section}-${mode}`}
          courseId={courseId}
          section={section}
          mode={mode}
          onStats={(s) => setStats({ ...s, learning: 0 })}
        />
      )}
    </div>
  );
}

function StudyStatsPanel() {
  const [stats, setStats] = useState<{
    today: number;
    week: number;
    total: number;
    streak: number;
  } | null>(null);
  const [open, setOpen] = useState(false);

  const load = () => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => setStats(null));
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="text-sm font-medium text-stone-700 hover:text-stone-900"
      >
        {open ? "▾" : "▸"} Thống kê học hôm nay
      </button>
      {open && stats && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-stone-500">Hôm nay</p>
            <p className="text-xl font-semibold">{stats.today}</p>
          </div>
          <div>
            <p className="text-stone-500">7 ngày</p>
            <p className="text-xl font-semibold">{stats.week}</p>
          </div>
          <div>
            <p className="text-stone-500">Tổng</p>
            <p className="text-xl font-semibold">{stats.total}</p>
          </div>
          <div>
            <p className="text-stone-500">Chuỗi ngày</p>
            <p className="text-xl font-semibold">{stats.streak}</p>
          </div>
        </div>
      )}
    </div>
  );
}

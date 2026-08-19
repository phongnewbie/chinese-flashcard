"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { HskVocabStudy } from "@/components/hsk-vocab-study";
import { SentenceOrderStudy } from "@/components/sentence-order-study";
import { isAccessLocked, LockScreen, TrialBanner, useAccess } from "@/components/access-ui";
import { lockedSectionForCourse, STUDY_SECTIONS, type StudySectionId } from "@/lib/sections";
import type { DeckStats } from "@/components/anki-deck-overview";

type StudyMode = "review" | "all" | "new";

type Props = {
  courseId: string;
  title: string;
  primarySection: string | null;
  hskLevel: string | null;
};

export function StudyClient({ courseId, title, primarySection, hskLevel }: Props) {
  const { access, loading: accessLoading } = useAccess();
  const lockedSection = lockedSectionForCourse({ primarySection, hskLevel });
  const singleSection = lockedSection !== null;
  const [section, setSection] = useState<StudySectionId>(lockedSection ?? "vocabulary");
  const [mode, setMode] = useState<StudyMode>("review");
  const [stats, setStats] = useState<DeckStats>({ due: 0, new: 0, queue: 0, learning: 0, total: 0 });

  const activeSection = singleSection ? lockedSection! : section;

  const handleStats = useCallback((s: DeckStats) => {
    setStats(s);
  }, []);

  const sectionLabel = STUDY_SECTIONS.find((s) => s.id === activeSection)?.label;

  if (accessLoading) return <p className="text-stone-500">Đang tải...</p>;
  if (isAccessLocked(access)) return <LockScreen access={access!} />;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/hoc" className="text-sm text-stone-500 hover:text-stone-800">
          ← Bộ thẻ
        </Link>
        <h1 className="text-xl font-bold text-stone-900 mt-1">{title}</h1>
        {singleSection && sectionLabel && (
          <p className="text-sm text-stone-500 mt-0.5">{sectionLabel}</p>
        )}
      </div>
      <TrialBanner />

      {!singleSection && (
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
      )}

      <p className="text-xs text-stone-500 text-center">
        Mới: {stats.new} · Đang học: {stats.learning} · Ôn: {stats.due}
      </p>

      <StudyStatsPanel />

      {activeSection === "sentence_order" ? (
        <SentenceOrderStudy courseId={courseId} mode={mode} onModeChange={setMode} />
      ) : (
        <HskVocabStudy
          key={`${activeSection}-${mode}`}
          courseId={courseId}
          section={activeSection as "vocabulary" | "grammar" | "common"}
          mode={mode}
          onModeChange={setMode}
          onStats={handleStats}
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

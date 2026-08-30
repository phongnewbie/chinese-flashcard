"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  categoriesForLevel,
  categoryLabel,
  HSK_LEVELS,
} from "@/lib/hsk-levels";

type CourseRow = {
  id: string;
  title: string;
  hskLevel: string | null;
  primarySection: string | null;
  _count: { cards: number };
};

type Props = {
  courseId: string;
  courseTitle: string;
  hskLevel: string | null;
  primarySection: string;
  sidebarFilter: string;
  onShowAllInCourse: () => void;
};

function matches(text: string, filter: string) {
  if (!filter) return true;
  return text.toLowerCase().includes(filter.toLowerCase());
}

export function AnkiBrowseDeckTree({
  courseId,
  courseTitle,
  hskLevel,
  primarySection,
  sidebarFilter,
  onShowAllInCourse,
}: Props) {
  const router = useRouter();
  const filterLower = sidebarFilter.trim().toLowerCase();

  const [coursesByLevel, setCoursesByLevel] = useState<Record<string, CourseRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [rootOpen, setRootOpen] = useState(true);
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({});
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/admin/hsk-board")
      .then((r) => r.json())
      .then((data) => setCoursesByLevel(data.coursesByLevel ?? {}))
      .catch(() => setCoursesByLevel({}))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const levels: Record<string, boolean> = {};
    const cats: Record<string, boolean> = {};
    for (const level of HSK_LEVELS) {
      levels[level.id] = level.id === hskLevel;
    }
    if (hskLevel) {
      for (const cat of categoriesForLevel(hskLevel)) {
        cats[`${hskLevel}:${cat.id}`] = cat.id === primarySection;
      }
    }
    setExpandedLevels(levels);
    setExpandedCats(cats);
  }, [hskLevel, primarySection]);

  const visibleLevels = useMemo(() => {
    return HSK_LEVELS.filter((level) => {
      if (!filterLower) return true;
      if (level.label.toLowerCase().includes(filterLower)) return true;
      const courses = coursesByLevel[level.id] ?? [];
      return courses.some(
        (c) =>
          matches(c.title, filterLower) ||
          matches(categoryLabel(c.primarySection ?? ""), filterLower),
      );
    });
  }, [coursesByLevel, filterLower]);

  const goCourse = useCallback(
    (id: string) => {
      if (id !== courseId) router.push(`/admin/khoa/${id}`);
      else onShowAllInCourse();
    },
    [courseId, onShowAllInCourse, router],
  );

  if (loading) {
    return <p className="anki-deck-tree-loading">Đang tải bộ thẻ…</p>;
  }

  const showTree =
    !filterLower ||
    matches("bộ thẻ", filterLower) ||
    matches("hiện hành", filterLower) ||
    visibleLevels.length > 0;

  if (!showTree) return null;

  return (
    <div className="anki-deck-tree-block">
      <button
        type="button"
        className={`anki-win-deck anki-win-deck-root depth-0 ${rootOpen ? "open" : ""}`}
        onClick={() => setRootOpen((o) => !o)}
      >
        <span className="chev">{rootOpen ? "▾" : "▸"}</span>
        <span className="deck-icon deck-icon-root" aria-hidden />
        <span className="name">Bộ thẻ</span>
      </button>

      {rootOpen && (
        <div className="anki-deck-tree-children">
          <button
            type="button"
            className="anki-win-deck depth-1"
            onClick={onShowAllInCourse}
            title={courseTitle}
          >
            <span className="chev" />
            <span className="deck-icon deck-icon-current" aria-hidden />
            <span className="name">Bộ Thẻ Hiện hành</span>
          </button>

          {visibleLevels.map((level) => {
            const courses = coursesByLevel[level.id] ?? [];
            const levelLabel = level.label.toUpperCase();
            const levelOpen = filterLower ? true : (expandedLevels[level.id] ?? false);

            const levelVisible =
              !filterLower ||
              levelLabel.toLowerCase().includes(filterLower) ||
              courses.some(
                (c) =>
                  matches(c.title, filterLower) ||
                  matches(categoryLabel(c.primarySection ?? ""), filterLower),
              );
            if (!levelVisible) return null;

            return (
              <div key={level.id} className="anki-deck-branch">
                <button
                  type="button"
                  className={`anki-win-deck depth-1 ${levelOpen ? "open" : ""}`}
                  onClick={() =>
                    setExpandedLevels((p) => ({ ...p, [level.id]: !levelOpen }))
                  }
                >
                  <span className="chev">{levelOpen ? "▾" : "▸"}</span>
                  <span className="deck-icon deck-icon-folder" aria-hidden />
                  <span className="name">{levelLabel}</span>
                </button>

                {levelOpen &&
                  categoriesForLevel(level.id).map((cat) => {
                    const catKey = `${level.id}:${cat.id}`;
                    const catLabel = categoryLabel(cat.id);
                    const lessons = courses.filter((c) => c.primarySection === cat.id);
                    const visibleLessons = lessons.filter(
                      (c) =>
                        !filterLower ||
                        matches(c.title, filterLower) ||
                        matches(catLabel, filterLower) ||
                        levelLabel.toLowerCase().includes(filterLower),
                    );
                    const catMatches =
                      !filterLower ||
                      matches(catLabel, filterLower) ||
                      visibleLessons.length > 0 ||
                      levelLabel.toLowerCase().includes(filterLower);
                    if (!catMatches) return null;

                    const catOpen = filterLower ? true : (expandedCats[catKey] ?? false);
                    const singleCourse = visibleLessons.length === 1 ? visibleLessons[0] : null;

                    if (singleCourse && !filterLower) {
                      const selected = singleCourse.id === courseId;
                      return (
                        <button
                          key={catKey}
                          type="button"
                          className={`anki-win-deck depth-2 leaf ${selected ? "sel" : ""}`}
                          onClick={() => goCourse(singleCourse.id)}
                          title={singleCourse.title}
                        >
                          <span className="chev" />
                          <span className="deck-icon deck-icon-leaf" aria-hidden />
                          <span className="name">{catLabel}</span>
                        </button>
                      );
                    }

                    return (
                      <div key={catKey}>
                        <button
                          type="button"
                          className={`anki-win-deck depth-2 ${catOpen ? "open" : ""}`}
                          onClick={() =>
                            setExpandedCats((p) => ({ ...p, [catKey]: !catOpen }))
                          }
                        >
                          <span className="chev">{catOpen ? "▾" : "▸"}</span>
                          <span className="deck-icon deck-icon-folder" aria-hidden />
                          <span className="name">{catLabel}</span>
                        </button>

                        {catOpen &&
                          visibleLessons.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className={`anki-win-deck depth-3 leaf ${c.id === courseId ? "sel" : ""}`}
                              onClick={() => goCourse(c.id)}
                              title={`${c.title} · ${c._count.cards} thẻ`}
                            >
                              <span className="chev" />
                              <span className="deck-icon deck-icon-leaf" aria-hidden />
                              <span className="name">{c.title}</span>
                            </button>
                          ))}

                        {catOpen && visibleLessons.length === 0 && (
                          <div className="anki-deck-tree-empty depth-3">Chưa có bộ thẻ</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

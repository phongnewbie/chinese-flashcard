"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  categoriesForLevel,
  categoryDeckLabel,
  HSK_LEVELS,
  type HskCategoryId,
} from "@/lib/hsk-levels";
import { AdminBtnDanger, AdminBtnPrimary, adminInputClass } from "./admin-ui";

export type AdminLessonCourse = {
  id: string;
  title: string;
  hskLevel: string | null;
  primarySection: string | null;
  lessonNumber: number | null;
  _count: { cards: number };
};

type Props = {
  coursesByLevel: Record<string, AdminLessonCourse[]>;
  onAddLesson: (hskLevel: string, primarySection: HskCategoryId, title: string) => Promise<void>;
  onRenameLesson: (courseId: string, title: string) => Promise<void>;
  onDeleteLesson: (courseId: string, title: string) => Promise<void>;
};

function matchesFilter(text: string, filter: string) {
  if (!filter) return true;
  return text.toLowerCase().includes(filter.toLowerCase());
}

export function AdminDeckTree({
  coursesByLevel,
  onAddLesson,
  onRenameLesson,
  onDeleteLesson,
}: Props) {
  const [filter, setFilter] = useState("");
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({});
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [addDraft, setAddDraft] = useState<{ levelId: string; catId: HskCategoryId } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const levels: Record<string, boolean> = {};
    const cats: Record<string, boolean> = {};
    for (const level of HSK_LEVELS) {
      levels[level.id] = true;
      for (const cat of categoriesForLevel(level.id)) {
        cats[`${level.id}:${cat.id}`] = true;
      }
    }
    setExpandedLevels(levels);
    setExpandedCats(cats);
  }, []);

  const filterLower = filter.trim().toLowerCase();

  const visibleLevels = useMemo(() => {
    return HSK_LEVELS.filter((level) => {
      if (!filterLower) return true;
      if (level.label.toLowerCase().includes(filterLower)) return true;
      const courses = coursesByLevel[level.id] ?? [];
      return courses.some((c) => c.title.toLowerCase().includes(filterLower));
    });
  }, [coursesByLevel, filterLower]);

  const submitAdd = async () => {
    if (!addDraft || !newTitle.trim()) return;
    await onAddLesson(addDraft.levelId, addDraft.catId, newTitle.trim());
    setAddDraft(null);
    setNewTitle("");
  };

  const submitRename = async (courseId: string) => {
    if (!renameTitle.trim()) return;
    await onRenameLesson(courseId, renameTitle.trim());
    setRenamingId(null);
    setRenameTitle("");
  };

  return (
    <div className="admin-deck-browser">
      <aside className="admin-deck-sidebar">
        <div className="admin-deck-sidebar-search">
          <input
            type="search"
            placeholder="Lọc bộ thẻ…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={adminInputClass()}
          />
        </div>
        <div className="admin-deck-tree-scroll">
          <div className="admin-deck-tree-heading">Decks</div>
          {visibleLevels.map((level) => {
            const courses = coursesByLevel[level.id] ?? [];
            const levelOpen = filterLower ? true : (expandedLevels[level.id] ?? false);
            const levelLabel = level.label.toUpperCase();

            const levelVisible =
              !filterLower ||
              levelLabel.toLowerCase().includes(filterLower) ||
              courses.some((c) => matchesFilter(c.title, filterLower));

            if (!levelVisible) return null;

            return (
              <div key={level.id} className="admin-deck-tree-branch">
                <button
                  type="button"
                  className="admin-deck-tree-row"
                  style={{ paddingLeft: 8 }}
                  onClick={() =>
                    setExpandedLevels((p) => ({ ...p, [level.id]: !levelOpen }))
                  }
                >
                  <span className="admin-deck-tree-chevron">{levelOpen ? "▼" : "▶"}</span>
                  <span className="admin-deck-tree-icon">📁</span>
                  <span className="admin-deck-tree-label">
                    <strong>{levelLabel}</strong>
                  </span>
                  <span className="admin-deck-tree-meta">{courses.length} bộ</span>
                </button>

                {levelOpen &&
                  categoriesForLevel(level.id).map((cat) => {
                    const catKey = `${level.id}:${cat.id}`;
                    const catLabel = categoryDeckLabel(cat.id, level.id);
                    const lessons = courses.filter((c) => c.primarySection === cat.id);
                    const visibleLessons = lessons.filter((c) =>
                      matchesFilter(c.title, filterLower),
                    );
                    const catMatches =
                      !filterLower ||
                      catLabel.toLowerCase().includes(filterLower) ||
                      visibleLessons.length > 0;
                    if (!catMatches) return null;

                    const catOpen = filterLower ? true : (expandedCats[catKey] ?? true);
                    const isAdding = addDraft?.levelId === level.id && addDraft.catId === cat.id;

                    return (
                      <div key={catKey}>
                        <button
                          type="button"
                          className="admin-deck-tree-row"
                          style={{ paddingLeft: 24 }}
                          onClick={() =>
                            setExpandedCats((p) => ({ ...p, [catKey]: !catOpen }))
                          }
                        >
                          <span className="admin-deck-tree-chevron">{catOpen ? "▼" : "▶"}</span>
                          <span className="admin-deck-tree-icon">📂</span>
                          <span className="admin-deck-tree-label">{catLabel}</span>
                          <span className="admin-deck-tree-meta">{lessons.length}</span>
                          <button
                            type="button"
                            className="admin-deck-tree-action"
                            title="Thêm bộ thẻ"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddDraft({ levelId: level.id, catId: cat.id });
                              setNewTitle("");
                              setExpandedLevels((p) => ({ ...p, [level.id]: true }));
                              setExpandedCats((p) => ({ ...p, [catKey]: true }));
                            }}
                          >
                            +
                          </button>
                        </button>

                        {catOpen && isAdding && (
                          <div className="admin-deck-tree-add" style={{ paddingLeft: 40 }}>
                            <input
                              type="text"
                              autoFocus
                              placeholder="Tên bộ thẻ (VD: Từ vựng HSK3 - P1)"
                              value={newTitle}
                              onChange={(e) => setNewTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void submitAdd();
                                if (e.key === "Escape") setAddDraft(null);
                              }}
                              className={adminInputClass()}
                            />
                            <div className="admin-deck-tree-add-actions">
                              <AdminBtnPrimary onClick={() => void submitAdd()}>Tạo</AdminBtnPrimary>
                              <button type="button" className="admin-link-btn" onClick={() => setAddDraft(null)}>
                                Hủy
                              </button>
                            </div>
                          </div>
                        )}

                        {catOpen &&
                          visibleLessons.map((c) => (
                            <div
                              key={c.id}
                              className={`admin-deck-tree-row admin-deck-tree-leaf ${selectedId === c.id ? "sel" : ""}`}
                              style={{ paddingLeft: 40 }}
                              onClick={() => setSelectedId(c.id)}
                              onKeyDown={(e) => e.key === "Enter" && setSelectedId(c.id)}
                              role="button"
                              tabIndex={0}
                            >
                              <span className="admin-deck-tree-chevron" />
                              <span className="admin-deck-tree-icon">🔖</span>
                              {renamingId === c.id ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={renameTitle}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setRenameTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === "Enter") void submitRename(c.id);
                                    if (e.key === "Escape") {
                                      setRenamingId(null);
                                      setRenameTitle("");
                                    }
                                  }}
                                  onBlur={() => void submitRename(c.id)}
                                  className={adminInputClass("flex-1 min-w-0")}
                                />
                              ) : (
                                <span className="admin-deck-tree-label" title={c.title}>
                                  {c.title}
                                </span>
                              )}
                              <span className="admin-deck-tree-meta">{c._count.cards} thẻ</span>
                            </div>
                          ))}

                        {catOpen && visibleLessons.length === 0 && !isAdding && (
                          <div className="admin-deck-tree-empty" style={{ paddingLeft: 40 }}>
                            {filterLower ? "Không khớp bộ lọc" : 'Chưa có bộ thẻ — bấm "+"'}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </aside>

      <div className="admin-deck-detail">
        {selectedId ? (
          (() => {
            const course = Object.values(coursesByLevel)
              .flat()
              .find((c) => c.id === selectedId);
            if (!course) return <p className="text-stone-500 text-sm">Chọn bộ thẻ bên trái</p>;
            return (
              <div className="admin-deck-detail-inner">
                <h3 className="font-semibold text-lg">{course.title}</h3>
                <p className="text-sm text-stone-600 mt-1">
                  {course.hskLevel?.toUpperCase()} · {course.primarySection} · {course._count.cards} thẻ
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Link href={`/admin/khoa/${course.id}`} className="admin-link-btn font-medium">
                    → Nhập liệu / Browse
                  </Link>
                  <Link href={`/hoc/${course.id}`} className="admin-link-btn">
                    Học thử
                  </Link>
                  <button
                    type="button"
                    className="admin-link-btn"
                    onClick={() => {
                      setRenamingId(course.id);
                      setRenameTitle(course.title);
                    }}
                  >
                    Sửa tên
                  </button>
                  <AdminBtnDanger onClick={() => void onDeleteLesson(course.id, course.title)}>
                    Xóa bộ thẻ
                  </AdminBtnDanger>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="admin-deck-detail-inner text-stone-500 text-sm">
            <p>Chọn một bộ thẻ trong cây bên trái để nhập liệu hoặc học thử.</p>
            <p className="mt-2 text-xs">
              Cấu trúc: <strong>HSK</strong> → <strong>mục học</strong> (Từ vựng, Ngữ pháp…) → <strong>bộ thẻ</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

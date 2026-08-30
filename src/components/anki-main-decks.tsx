"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { canUserStudy, isAccessLocked, LockScreen, TrialBanner, useAccess } from "@/components/access-ui";
import { categoryDeckLabel, type HskCategoryId } from "@/lib/hsk-levels";
import type { DeckCountStats } from "@/lib/deck-overview-stats";
import { SectionTemplateEditor } from "@/components/section-template-editor";

type DeckRow = {
  id: string;
  title: string;
  hskLevel: string;
  primarySection: string;
  sortOrder: number;
  cardCount: number;
  stats: DeckCountStats;
};

type CategoryRow = {
  id: string;
  label: string;
  stats: DeckCountStats;
  decks: DeckRow[];
};

type LevelRow = {
  id: string;
  label: string;
  locked?: boolean;
  stats: DeckCountStats;
  categories: CategoryRow[];
};

type OverviewData = {
  isAdmin: boolean;
  enrolledLevels?: string[];
  hskRestricted?: boolean;
  levels: LevelRow[];
  studiedToday: number;
};

function CountCell({ value, tone }: { value: number; tone: "blue" | "red" | "muted" }) {
  if (!value) return <td className="anki-deck-count" />;
  const cls =
    tone === "blue" ? "anki-deck-count blue" : tone === "red" ? "anki-deck-count red" : "anki-deck-count muted";
  return <td className={cls}>{value}</td>;
}

function StatsCells({ stats }: { stats: DeckCountStats }) {
  return (
    <>
      <CountCell value={stats.new} tone="blue" />
      <CountCell value={stats.learning} tone="red" />
      <CountCell value={stats.due} tone="muted" />
    </>
  );
}

export function AnkiMainDecks() {
  const router = useRouter();
  const { access, loading: accessLoading } = useAccess();

  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({ hsk1: true });
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [addDraft, setAddDraft] = useState<{ levelId: string; catId: HskCategoryId } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [dragDeck, setDragDeck] = useState<DeckRow | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [templateDialog, setTemplateDialog] = useState<{ sectionId: HskCategoryId; label: string } | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetch("/api/decks/overview")
      .then((r) => r.json())
      .then((json: OverviewData) => setData(json))
      .catch(() => setMsg("Không tải được danh sách bộ thẻ"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggleLevel = (id: string) =>
    setExpandedLevels((p) => ({ ...p, [id]: !p[id] }));

  const toggleCat = (key: string) =>
    setExpandedCats((p) => ({ ...p, [key]: !p[key] }));

  const openStudy = (deckId: string, levelLocked?: boolean) => {
    const adminAccount = data?.isAdmin || access?.isAdmin;
    if (!adminAccount && !canUserStudy(access)) return;
    if (levelLocked && !adminAccount) return;
    router.push(`/hoc/${deckId}`);
  };

  const createDeck = async () => {
    if (!addDraft || !newTitle.trim()) return;
    const res = await fetch("/api/admin/hsk-board/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hskLevel: addDraft.levelId,
        primarySection: addDraft.catId,
        title: newTitle.trim(),
      }),
    });
    if (res.ok) {
      setNewTitle("");
      setAddDraft(null);
      setExpandedLevels((p) => ({ ...p, [addDraft.levelId]: true }));
      setExpandedCats((p) => ({ ...p, [`${addDraft.levelId}:${addDraft.catId}`]: true }));
      reload();
    } else {
      const j = (await res.json()) as { error?: string };
      setMsg(j.error ?? "Không tạo được bộ thẻ");
    }
  };

  const reorderDecks = async (catDecks: DeckRow[], fromId: string, toId: string) => {
    if (!data?.isAdmin || fromId === toId) return;
    const ids = catDecks.map((d) => d.id);
    const fromIdx = ids.indexOf(fromId);
    const toIdx = ids.indexOf(toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...ids];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, fromId);
    await fetch("/api/admin/hsk-board/courses/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseIds: next }),
    });
    reload();
  };

  const renameDeck = async (deckId: string) => {
    const trimmed = renameTitle.trim();
    if (!trimmed) return;
    const res = await fetch(`/api/admin/courses/${deckId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    if (res.ok) {
      setRenamingId(null);
      setRenameTitle("");
      reload();
    } else {
      setMsg("Không đổi tên được");
    }
  };

  if (loading || accessLoading) {
    return (
      <div className="anki-home">
        <p className="text-stone-500 text-center py-12">Đang tải bộ thẻ…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="anki-home">
        <p className="text-red-600 text-center py-12">{msg || "Lỗi tải dữ liệu"}</p>
      </div>
    );
  }

  const isAdmin = data.isAdmin;
  const studyAllowed = isAdmin || canUserStudy(access);
  const locked = !isAdmin && isAccessLocked(access);

  return (
    <div className="anki-home">
      <nav className="anki-home-nav">
        <span className="anki-home-nav-item active">Bộ thẻ</span>
        {isAdmin && (
          <>
            <button
              type="button"
              className="anki-home-nav-item btn"
              onClick={() => {
                setAddDraft({ levelId: "hsk1", catId: "vocabulary" });
                setNewTitle("");
              }}
            >
              Thêm
            </button>
            <Link href="/admin" className="anki-home-nav-item btn">
              Duyệt / Quản trị
            </Link>
          </>
        )}
      </nav>

      <TrialBanner />

      {locked && access && (
        <div className="mb-4">
          <LockScreen access={access} />
        </div>
      )}

      {data.hskRestricted && !isAdmin && (
        <p className="text-sm text-stone-600 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 mb-3">
          Bạn chỉ được học các cấp HSK admin đã gán. Các cấp khác bị khóa 🔒
        </p>
      )}

      {msg && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-3">
          {msg}
        </p>
      )}

      {isAdmin && addDraft && (
        <div className="anki-add-deck-bar">
          <span className="text-sm text-stone-600">Tạo bộ thẻ mới:</span>
          <select
            value={addDraft.levelId}
            onChange={(e) => setAddDraft({ ...addDraft, levelId: e.target.value })}
            className="anki-add-select"
          >
            {data.levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <select
            value={addDraft.catId}
            onChange={(e) =>
              setAddDraft({ ...addDraft, catId: e.target.value as HskCategoryId })
            }
            className="anki-add-select"
          >
            {data.levels
              .find((l) => l.id === addDraft.levelId)
              ?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryDeckLabel(c.id, addDraft.levelId)}
                </option>
              ))}
          </select>
          <input
            type="text"
            placeholder="Tên bộ thẻ (VD: Từ vựng HSK 1 phần 1)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void createDeck()}
            className="anki-add-input"
          />
          <button type="button" className="anki-add-submit" onClick={() => void createDeck()}>
            Tạo
          </button>
          <button type="button" className="anki-add-cancel" onClick={() => setAddDraft(null)}>
            Hủy
          </button>
        </div>
      )}

      <div className="anki-deck-table-wrap">
        <table className="anki-deck-table">
          <thead>
            <tr>
              <th className="anki-deck-name-col">Bộ thẻ</th>
              <th className="anki-deck-stat-col">Mới</th>
              <th className="anki-deck-stat-col">Học</th>
              <th className="anki-deck-stat-col">Đến hạn</th>
              {isAdmin && <th className="anki-deck-gear-col" />}
            </tr>
          </thead>
          <tbody>
            {data.levels.map((level) => {
              const levelOpen = expandedLevels[level.id] ?? false;
              return (
                <LevelBlock
                  key={level.id}
                  level={level}
                  levelOpen={levelOpen}
                  levelLocked={!!level.locked && !isAdmin}
                  expandedCats={expandedCats}
                  isAdmin={isAdmin}
                  studyAllowed={studyAllowed}
                  dragDeck={dragDeck}
                  onToggleLevel={() => toggleLevel(level.id)}
                  onToggleCat={toggleCat}
                  onOpenStudy={openStudy}
                  onAddDeck={(levelId, catId) => {
                    setAddDraft({ levelId, catId: catId as HskCategoryId });
                    setNewTitle("");
                    setExpandedLevels((p) => ({ ...p, [levelId]: true }));
                    setExpandedCats((p) => ({ ...p, [`${levelId}:${catId}`]: true }));
                  }}
                  onOpenSectionTemplate={(sectionId, label) => setTemplateDialog({ sectionId, label })}
                  onDragStart={setDragDeck}
                  onDragEnd={() => setDragDeck(null)}
                  onDropDeck={reorderDecks}
                  renamingId={renamingId}
                  renameTitle={renameTitle}
                  onStartRename={(id, title) => {
                    setRenamingId(id);
                    setRenameTitle(title);
                  }}
                  onRenameTitleChange={setRenameTitle}
                  onRenameSubmit={renameDeck}
                  onRenameCancel={() => {
                    setRenamingId(null);
                    setRenameTitle("");
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="anki-home-footer">
        Đã học <strong>{data.studiedToday}</strong> thẻ hôm nay
        {isAdmin && (
          <> · Admin: bấm tên bộ thẻ để học như học viên · 🎨 mẫu hiển thị · ⚙ nhập liệu</>
        )}
      </p>

      {templateDialog && (
        <SectionTemplateEditor
          sectionId={templateDialog.sectionId}
          label={templateDialog.label}
          onClose={() => setTemplateDialog(null)}
        />
      )}
    </div>
  );
}

function LevelBlock({
  level,
  levelOpen,
  levelLocked,
  expandedCats,
  isAdmin,
  studyAllowed,
  dragDeck,
  onToggleLevel,
  onToggleCat,
  onOpenStudy,
  onAddDeck,
  onOpenSectionTemplate,
  onDragStart,
  onDragEnd,
  onDropDeck,
  renamingId,
  renameTitle,
  onStartRename,
  onRenameTitleChange,
  onRenameSubmit,
  onRenameCancel,
}: {
  level: LevelRow;
  levelOpen: boolean;
  levelLocked: boolean;
  expandedCats: Record<string, boolean>;
  isAdmin: boolean;
  studyAllowed: boolean;
  dragDeck: DeckRow | null;
  onToggleLevel: () => void;
  onToggleCat: (key: string) => void;
  onOpenStudy: (id: string, levelLocked?: boolean) => void;
  onAddDeck: (levelId: string, catId: string) => void;
  onOpenSectionTemplate: (sectionId: HskCategoryId, label: string) => void;
  onDragStart: (d: DeckRow) => void;
  onDragEnd: () => void;
  onDropDeck: (decks: DeckRow[], fromId: string, toId: string) => void;
  renamingId: string | null;
  renameTitle: string;
  onStartRename: (id: string, title: string) => void;
  onRenameTitleChange: (v: string) => void;
  onRenameSubmit: (id: string) => void;
  onRenameCancel: () => void;
}) {
  const deckStudyAllowed = studyAllowed && !levelLocked;

  return (
    <>
      <tr className={`anki-deck-row level ${levelLocked ? "locked" : ""}`} onClick={onToggleLevel}>
        <td className="anki-deck-name">
          <span className="anki-tree-toggle">{levelOpen ? "▾" : "▸"}</span>
          {levelLocked && <span className="anki-lock-icon">🔒</span>}
          <strong>{level.label}</strong>
          {levelLocked && (
            <span className="anki-deck-meta ml-2 text-stone-400">Chưa được mở</span>
          )}
        </td>
        <StatsCells stats={level.stats} />
        {isAdmin && <td />}
      </tr>
      {levelOpen &&
        level.categories.map((cat) => {
          const catKey = `${level.id}:${cat.id}`;
          const catOpen = expandedCats[catKey] ?? cat.decks.length > 0;
          const catLabel = categoryDeckLabel(cat.id, level.id);
          return (
            <CategoryBlock
              key={catKey}
              cat={cat}
              catLabel={catLabel}
              catOpen={catOpen}
              isAdmin={isAdmin}
              studyAllowed={deckStudyAllowed}
              levelLocked={levelLocked}
              dragDeck={dragDeck}
              onToggleCat={() => onToggleCat(catKey)}
              onOpenStudy={(id) => onOpenStudy(id, levelLocked)}
              onAddDeck={() => onAddDeck(level.id, cat.id)}
              onOpenSectionTemplate={() => onOpenSectionTemplate(cat.id as HskCategoryId, catLabel)}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDropDeck={onDropDeck}
              renamingId={renamingId}
              renameTitle={renameTitle}
              onStartRename={onStartRename}
              onRenameTitleChange={onRenameTitleChange}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
            />
          );
        })}
    </>
  );
}

function CategoryBlock({
  cat,
  catLabel,
  catOpen,
  isAdmin,
  studyAllowed,
  levelLocked,
  dragDeck,
  onToggleCat,
  onOpenStudy,
  onAddDeck,
  onOpenSectionTemplate,
  onDragStart,
  onDragEnd,
  onDropDeck,
  renamingId,
  renameTitle,
  onStartRename,
  onRenameTitleChange,
  onRenameSubmit,
  onRenameCancel,
}: {
  cat: CategoryRow;
  catLabel: string;
  catOpen: boolean;
  isAdmin: boolean;
  studyAllowed: boolean;
  levelLocked: boolean;
  dragDeck: DeckRow | null;
  onToggleCat: () => void;
  onOpenStudy: (id: string) => void;
  onAddDeck: () => void;
  onOpenSectionTemplate: () => void;
  onDragStart: (d: DeckRow) => void;
  onDragEnd: () => void;
  onDropDeck: (decks: DeckRow[], fromId: string, toId: string) => void;
  renamingId: string | null;
  renameTitle: string;
  onStartRename: (id: string, title: string) => void;
  onRenameTitleChange: (v: string) => void;
  onRenameSubmit: (id: string) => void;
  onRenameCancel: () => void;
}) {
  return (
    <>
      <tr className={`anki-deck-row category ${levelLocked ? "locked" : ""}`} onClick={onToggleCat}>
        <td className="anki-deck-name indent-1">
          <span className="anki-tree-toggle">{catOpen ? "▾" : "▸"}</span>
          {catLabel}
          {isAdmin && (
            <>
              <button
                type="button"
                className="anki-inline-add"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddDeck();
                }}
              >
                + thêm
              </button>
              <button
                type="button"
                className="anki-inline-add template"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSectionTemplate();
                }}
                title="Chỉnh mẫu hiển thị cho toàn bộ mục này"
              >
                🎨 mẫu
              </button>
            </>
          )}
        </td>
        <StatsCells stats={cat.stats} />
        {isAdmin && <td />}
      </tr>
      {catOpen &&
        cat.decks.map((deck) => (
          <tr
            key={deck.id}
            className={`anki-deck-row deck ${!studyAllowed ? "locked" : ""} ${dragDeck?.id === deck.id ? "dragging" : ""}`}
            draggable={isAdmin}
            onDragStart={() => isAdmin && onDragStart(deck)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => isAdmin && e.preventDefault()}
            onDrop={() => {
              if (dragDeck && isAdmin) onDropDeck(cat.decks, dragDeck.id, deck.id);
            }}
          >
            <td
              className="anki-deck-name indent-2"
              onClick={() => {
                if (renamingId === deck.id) return;
                studyAllowed && onOpenStudy(deck.id);
              }}
            >
              {isAdmin && <span className="anki-drag-handle" title="Kéo để sắp xếp">⠿</span>}
              {!isAdmin && !studyAllowed && <span className="anki-lock-icon">🔒</span>}
              {levelLocked && isAdmin && <span className="anki-lock-icon" title="Học viên chưa được gán cấp này">🔒</span>}
              {isAdmin && renamingId === deck.id ? (
                <input
                  type="text"
                  className="anki-rename-input"
                  value={renameTitle}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onRenameTitleChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void onRenameSubmit(deck.id);
                    if (e.key === "Escape") onRenameCancel();
                  }}
                  onBlur={() => void onRenameSubmit(deck.id)}
                />
              ) : (
                <span
                  className={studyAllowed ? "anki-deck-link" : "anki-deck-link disabled"}
                  onDoubleClick={(e) => {
                    if (!isAdmin) return;
                    e.stopPropagation();
                    onStartRename(deck.id, deck.title);
                  }}
                  title={isAdmin ? "Double-click để đổi tên" : undefined}
                >
                  {deck.title}
                </span>
              )}
              <span className="anki-deck-meta">{deck.cardCount} thẻ</span>
            </td>
            <StatsCells stats={deck.stats} />
            {isAdmin && (
              <td className="anki-deck-gear">
                <Link href={`/admin/khoa/${deck.id}`} title="Nhập liệu, trường, mẫu thẻ">
                  ⚙
                </Link>
              </td>
            )}
          </tr>
        ))}
      {catOpen && cat.decks.length === 0 && (
        <tr className="anki-deck-row empty">
          <td colSpan={isAdmin ? 5 : 4} className="indent-2 text-stone-400 text-sm py-2">
            Chưa có bộ thẻ — {isAdmin ? 'bấm "+ thêm"' : "admin sẽ thêm sau"}
          </td>
        </tr>
      )}
    </>
  );
}

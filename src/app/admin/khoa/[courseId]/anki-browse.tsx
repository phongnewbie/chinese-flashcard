"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildNoteFieldRows,
  getTags,
  noteFieldsToCardPayload,
  noteTypeLabel,
  resolveFieldDefs,
  type FlashcardRecord,
  type NoteFieldRow,
} from "@/lib/anki-note-fields";
import { STUDY_SECTIONS, sectionLabel, type StudySectionId } from "@/lib/sections";
import { AnkiFieldsDialog } from "./anki-fields-dialog";
import "./anki-browse.css";

type Props = {
  courseId: string;
  courseTitle: string;
  fieldDefsRaw: string | null;
  onMsg: (msg: string) => void;
  onAddNoteRef?: React.MutableRefObject<(() => void) | null>;
  onOpenSettings?: () => void;
  onFieldDefsSaved?: () => void;
};

export function AnkiBrowse({
  courseId,
  courseTitle,
  fieldDefsRaw,
  onMsg,
  onAddNoteRef,
  onOpenSettings,
  onFieldDefsSaved,
}: Props) {
  const fieldDefs = useMemo(() => resolveFieldDefs(fieldDefsRaw), [fieldDefsRaw]);
  const [localFieldDefsRaw, setLocalFieldDefsRaw] = useState<string | null>(fieldDefsRaw);
  const [fieldsDialogOpen, setFieldsDialogOpen] = useState(false);
  const [sectionFilter, setSectionFilter] = useState("");
  const [cardState, setCardState] = useState("");
  const [search, setSearch] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true, hsk3: true });
  const [cards, setCards] = useState<FlashcardRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [bySection, setBySection] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fields, setFields] = useState<NoteFieldRow[]>([]);
  const [editSection, setEditSection] = useState<StudySectionId>("vocabulary");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selected = cards.find((c) => c.id === selectedId) ?? null;
  const selectedIndex = cards.findIndex((c) => c.id === selectedId);

  const loadCards = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sectionFilter) params.set("section", sectionFilter);
    if (search.trim()) params.set("q", search.trim());
    if (cardState) params.set("state", cardState);
    params.set("limit", "500");
    const res = await fetch(`/api/admin/courses/${courseId}/browse?${params}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return;
    setCards(data.cards);
    setTotal(data.total);
    setBySection(data.bySection ?? {});
  }, [courseId, sectionFilter, search, cardState]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  useEffect(() => {
    if (!selected && cards.length > 0 && !loading) setSelectedId(cards[0].id);
  }, [cards, selected, loading]);

  useEffect(() => {
    setLocalFieldDefsRaw(fieldDefsRaw);
  }, [fieldDefsRaw]);

  const activeFieldDefsRaw = localFieldDefsRaw ?? fieldDefsRaw;

  useEffect(() => {
    if (!selected) {
      setFields([]);
      return;
    }
    setFields(buildNoteFieldRows(selected, activeFieldDefsRaw));
    setEditSection(selected.section as StudySectionId);
    setDirty(false);
  }, [selected, activeFieldDefsRaw]);

  const updateField = (key: string, value: string) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
    setDirty(true);
  };

  const saveNote = async () => {
    if (!selected) return;
    setSaving(true);
    const payload = noteFieldsToCardPayload(editSection, fields);
    if (!payload.front || !payload.back) {
      onMsg("CHỮ HÁN và NGHĨA không được trống");
      setSaving(false);
      return;
    }
    const extras = payload.extraFields
      ? (JSON.parse(payload.extraFields) as Record<string, string>)
      : {};
    const res = await fetch(`/api/admin/courses/${courseId}/cards/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, extraFields: extras }),
    });
    setSaving(false);
    if (res.ok) {
      onMsg("");
      setDirty(false);
      void loadCards();
    } else onMsg("Lỗi lưu thẻ");
  };

  const addNote = useCallback(async () => {
    const res = await fetch(`/api/admin/courses/${courseId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: sectionFilter || "vocabulary",
        front: "新",
        back: "nghĩa mới",
        pinyin: "xīn",
        extraFields: { "HÁN VIỆT": "Tân" },
      }),
    });
    const card = await res.json();
    if (res.ok) {
      await loadCards();
      setSelectedId(card.id);
    }
  }, [courseId, sectionFilter, loadCards]);

  useEffect(() => {
    if (onAddNoteRef) onAddNoteRef.current = () => void addNote();
  }, [addNote, onAddNoteRef]);

  const pickDeck = (section: string, deckName: string) => {
    setSectionFilter(section);
    setCardState("");
    setSearch(`deck:"${deckName}" `);
  };

  const filterByFlag = (n: number) => {
    setSearch((s) => {
      const cleaned = s.replace(/\bflag:\d\b/gi, "").trim();
      return `${cleaned} flag:${n}`.trim() + " ";
    });
  };

  const cardAction = async (body: Record<string, unknown>) => {
    if (!selected) return;
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: selected.id, cardType: "default", ...body }),
    });
    if (res.ok) {
      onMsg("Đã cập nhật trạng thái thẻ");
      void loadCards();
    } else onMsg("Lỗi cập nhật thẻ");
  };

  const setCardFlag = async (flag: number) => {
    if (!selected) return;
    const res = await fetch(`/api/admin/courses/${courseId}/cards/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flag }),
    });
    if (res.ok) {
      onMsg("");
      void loadCards();
    }
  };

  const previewFront = fields.find((f) => f.label === "CHỮ HÁN" || f.key === "front")?.value ?? selected?.front ?? "";
  const previewBack = fields.find((f) => f.label === "NGHĨA" || f.key === "back")?.value ?? selected?.back ?? "";

  return (
    <>
    <div className="anki-win">
      <div className="anki-win-titlebar">
        Browse ({selectedIndex >= 0 ? selectedIndex + 1 : 0} of {total} notes selected)
      </div>

      <div className="anki-win-menubar">
        <Link href="/admin" className="anki-win-back">← Decks</Link>
        <span>Edit</span>
        <span>View</span>
        <span>Notes</span>
        <span>Cards</span>
        <span>Go</span>
        <span>Help</span>
      </div>

      <div className="anki-win-body">
        {/* LEFT SIDEBAR */}
        <aside className="anki-win-sidebar">
          <div className="anki-sidebar-filter">
            <input
              value={sidebarFilter}
              onChange={(e) => setSidebarFilter(e.target.value)}
              placeholder="Sidebar filter"
            />
          </div>
          <div className="anki-sidebar-scroll">
          {!sidebarFilter || /today|due|added|edited|studied/i.test(sidebarFilter) ? (
            <>
          <h4>Today</h4>
          <button type="button" className="anki-sidebar-item">Due</button>
          <button type="button" className="anki-sidebar-item">Added</button>
          <button type="button" className="anki-sidebar-item">Edited</button>
          <button type="button" className="anki-sidebar-item">Studied</button>
            </>
          ) : null}

          {(!sidebarFilter || /flag/i.test(sidebarFilter)) && (
            <>
          <h4>Flags</h4>
          <div className="anki-win-flags">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button key={n} type="button" onClick={() => filterByFlag(n)} title={`flag:${n}`}>
                {["", "🚩", "🟠", "🟢", "🔵", "🩷", "🟣", "🟤"][n]}
              </button>
            ))}
          </div>
            </>
          )}

          {(!sidebarFilter || /new|learn|review|suspend|state|card/i.test(sidebarFilter)) && (
            <>
          <h4>Card State</h4>
          <button
            type="button"
            className={`anki-sidebar-item ${cardState === "new" ? "sel" : ""}`}
            onClick={() => { setCardState("new"); setSearch(""); }}
          >
            <span className="anki-state-dot new" />
            New
          </button>
          <button
            type="button"
            className={`anki-sidebar-item ${cardState === "learning" ? "sel" : ""}`}
            onClick={() => { setCardState("learning"); setSearch(""); }}
          >
            <span className="anki-state-dot learning" />
            Learning
          </button>
          <button
            type="button"
            className={`anki-sidebar-item ${cardState === "review" ? "sel" : ""}`}
            onClick={() => { setCardState("review"); setSearch(""); }}
          >
            <span className="anki-state-dot review" />
            Review
          </button>
          <button
            type="button"
            className={`anki-sidebar-item ${cardState === "suspended" ? "sel" : ""}`}
            onClick={() => { setCardState("suspended"); setSearch(""); }}
          >
            <span className="anki-state-dot suspended" />
            Suspended
          </button>
            </>
          )}

          {(!sidebarFilter || /deck|hsk|vocab|ngữ|grammar|common/i.test(sidebarFilter)) && (
            <>
          <h4>Decks</h4>
          <button type="button" className="anki-win-deck" onClick={() => setExpanded((p) => ({ ...p, root: !p.root }))}>
            <span className="chev">{expanded.root ? "▾" : "▸"}</span>
            <span className="name">{courseTitle.toUpperCase()}</span>
          </button>
          {expanded.root && (
            <>
              {STUDY_SECTIONS.filter((s) =>
                !sidebarFilter || s.label.toLowerCase().includes(sidebarFilter.toLowerCase()),
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`anki-win-deck child ${sectionFilter === s.id ? "sel" : ""}`}
                  onClick={() => pickDeck(s.id, s.label)}
                >
                  <span className="chev">▸</span>
                  <span className="name">{s.label}</span>
                </button>
              ))}
              {(!sidebarFilter || /hsk|vocab|từ/i.test(sidebarFilter)) && (
                <>
              <button
                type="button"
                className={`anki-win-deck child ${sectionFilter === "vocabulary" ? "sel" : ""}`}
                onClick={() => {
                  setExpanded((p) => ({ ...p, hsk3: !p.hsk3 }));
                  pickDeck("vocabulary", "TỪ VỰNG HSK3");
                }}
              >
                <span className="chev">{expanded.hsk3 ? "▾" : "▸"}</span>
                <span className="name">TỪ VỰNG HSK3</span>
              </button>
              {expanded.hsk3 &&
                Array.from({ length: Math.min(11, Math.ceil((bySection.vocabulary ?? 0) / 50) || 3) }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="anki-win-deck grandchild"
                    onClick={() => pickDeck("vocabulary", `Từ vựng HSK3 - P${i + 1}`)}
                  >
                    <span className="chev">▸</span>
                    <span className="name">Từ vựng HSK3 - P{i + 1}</span>
                  </button>
                ))}
                </>
              )}
            </>
          )}
            </>
          )}
          </div>
        </aside>

        {/* CENTER — search + table */}
        <div className="anki-win-list-pane">
          <div className="anki-win-list-toolbar">
            <label className="anki-win-notes-toggle">
              Notes
              <input type="checkbox" defaultChecked readOnly />
            </label>
            <input
              className="anki-win-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void loadCards()}
              placeholder={`deck:"${courseTitle}"`}
            />
          </div>
          <div className="anki-win-table-wrap">
          {loading ? (
            <p className="anki-win-empty">Đang tải…</p>
          ) : cards.length === 0 ? (
            <p className="anki-win-empty">Không có note — bấm Notes → Add</p>
          ) : (
            <table className="anki-win-table">
              <colgroup>
                <col className="col-sort" />
                <col className="col-type" />
                <col className="col-cards" />
                <col className="col-tags" />
              </colgroup>
              <thead>
                <tr>
                  <th>Sort Field</th>
                  <th>Note Type</th>
                  <th className="col-cards-h">Cards</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr
                    key={c.id}
                    className={selectedId === c.id ? "sel" : ""}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td className="sort" title={c.pinyin || c.front}>{c.pinyin || c.front}</td>
                    <td className="ntype" title={noteTypeLabel(c.section)}>{noteTypeLabel(c.section)}</td>
                    <td className="cards-col">{c.cardCount ?? 1}</td>
                    <td className="tags-col" title={c.tags ?? getTags(c)}>{c.tags ?? getTags(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
        </div>

        {/* RIGHT EDITOR */}
        <div className="anki-win-editor">
          {!selected ? (
            <p className="anki-win-empty">Chọn note trong bảng</p>
          ) : (
            <>
              <div className="anki-win-editor-top">
                <div className="anki-win-editor-top-left">
                  <button type="button" onClick={() => setFieldsDialogOpen(true)} title="Quản lý trường & font chữ">
                    Fields…
                  </button>
                  <button type="button" onClick={() => onOpenSettings?.()}>Cards…</button>
                  <button type="button" onClick={() => setPreviewOpen(true)}>Preview</button>
                </div>
                <div className="anki-win-editor-top-right">
                  <button type="button" onClick={() => void cardAction({ suspend: true })} title="Suspend">⏸</button>
                  <button type="button" onClick={() => void cardAction({ bury: true })} title="Bury">⊘</button>
                  <select
                    value={selected.flag ?? 0}
                    onChange={(e) => void setCardFlag(Number(e.target.value))}
                    title="Flag"
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>Flag {n}</option>
                    ))}
                  </select>
                  <select
                    value={editSection}
                    onChange={(e) => {
                      setEditSection(e.target.value as StudySectionId);
                      setDirty(true);
                    }}
                  >
                    {STUDY_SECTIONS.map((s) => (
                      <option key={s.id} value={s.id}>{sectionLabel(s.id)}</option>
                    ))}
                  </select>
                  <button type="button" className="anki-win-save" disabled={!dirty || saving} onClick={() => void saveNote()}>
                    {saving ? "…" : "Lưu"}
                  </button>
                </div>
              </div>

              <div className="anki-win-fmt">
                <button type="button" title="Settings">⚙</button>
                <span className="sep" />
                <button type="button"><b>B</b></button>
                <button type="button"><i>I</i></button>
                <button type="button"><u>U</u></button>
                <button type="button">x²</button>
                <button type="button">x₂</button>
                <span className="sep" />
                <button type="button" className="red-a">A</button>
                <button type="button">▮</button>
                <span className="sep" />
                <button type="button">☰</button>
                <button type="button">•</button>
                <button type="button">🔗</button>
                <button type="button">🖼</button>
                <button type="button">♪</button>
                <button type="button">fx</button>
                <span className="sep" />
                <button type="button">&lt;/&gt;</button>
              </div>

              <div className="anki-win-fields">
                {fields
                  .filter((f) => f.label !== "Tags")
                  .map((f) => (
                    <div key={f.key} className="anki-field-block">
                      <div className="anki-field-head">
                        <span className="anki-field-chev">▾</span>
                        <span className="anki-field-title">{f.label}</span>
                        <span className="anki-field-font-badge">
                          {f.fontFamily ?? "Arial"} · {f.fontSize ?? 20}px
                        </span>
                        <span className="anki-field-code">&lt;/&gt;</span>
                      </div>
                      <div className="anki-field-body">
                        {f.multiline ? (
                          <textarea
                            className={f.label === "VÍ DỤ" || f.label === "GHI CHÚ" ? "tall" : ""}
                            value={f.value}
                            onChange={(e) => updateField(f.key, e.target.value)}
                            rows={f.label === "VÍ DỤ" ? 5 : 3}
                            placeholder={f.placeholder}
                            style={{
                              fontFamily: f.fontFamily ?? "Segoe UI",
                              fontSize: f.fontSize ? `${f.fontSize}px` : undefined,
                              direction: f.rtl ? "rtl" : undefined,
                            }}
                          />
                        ) : (
                          <input
                            value={f.value}
                            onChange={(e) => updateField(f.key, e.target.value)}
                            placeholder={f.placeholder}
                            style={{
                              fontFamily: f.fontFamily ?? "Segoe UI",
                              fontSize: f.fontSize ? `${f.fontSize}px` : undefined,
                              direction: f.rtl ? "rtl" : undefined,
                            }}
                          />
                        )}
                        {f.isImage && f.value && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imgUrl(f.value)} alt="" className="img-inline" />
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              <div className="anki-tags-bar">
                <span className="tag-icon">🏷</span>
                <input
                  value={fields.find((f) => f.label === "Tags")?.value ?? ""}
                  onChange={(e) => updateField("extra:Tags", e.target.value)}
                  placeholder="tags"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>

    {previewOpen && selected && (
      <div className="anki-preview-overlay" onClick={() => setPreviewOpen(false)}>
        <div className="anki-preview-card" onClick={(e) => e.stopPropagation()}>
          <h3>Preview</h3>
          <div className="anki-preview-front">{previewFront}</div>
          <hr />
          <div className="anki-preview-back">{previewBack}</div>
          <button type="button" onClick={() => setPreviewOpen(false)}>Đóng</button>
        </div>
      </div>
    )}

    <AnkiFieldsDialog
      courseId={courseId}
      fieldDefsRaw={activeFieldDefsRaw}
      open={fieldsDialogOpen}
      onClose={() => setFieldsDialogOpen(false)}
      onSaved={(json) => {
        setLocalFieldDefsRaw(json);
        onMsg("Đã lưu — font & trường cập nhật");
        onFieldDefsSaved?.();
        if (selected) {
          setFields(buildNoteFieldRows(selected, json));
        }
      }}
    />
    </>
  );
}

function imgUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  return `/uploads/images/${encodeURIComponent(raw.replace(/^.*[\\/]/, ""))}`;
}

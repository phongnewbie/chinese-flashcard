"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildNoteFieldRows,
  fieldDefsRawForSection,
  getTags,
  noteFieldsToCardPayload,
  noteTypeLabel,
  sortFieldLabel,
  sortFieldValue,
  type FlashcardRecord,
  type NoteFieldRow,
} from "@/lib/anki-note-fields";
import { requiredFieldLabels, getSectionPreset } from "@/lib/section-presets";
import { STUDY_SECTIONS, sectionLabel, type StudySectionId } from "@/lib/sections";
import { AnkiBrowseDeckTree } from "./anki-browse-deck-tree";
import { AnkiFieldsDialog } from "./anki-fields-dialog";
import { AnkiImageField, fieldImagePreview } from "./anki-image-field";
import { AnkiRichField } from "./anki-rich-field";
import {
  applyImageToFieldValue,
  clipboardImageFile,
  fieldUsesImageEditor,
  uploadImageFile,
  usesRichEditorField,
} from "@/lib/paste-image";
import "./anki-browse.css";

type Props = {
  courseId: string;
  courseTitle: string;
  hskLevel?: string | null;
  defaultSection?: StudySectionId;
  fieldDefsRaw: string | null;
  onMsg: (msg: string) => void;
  onAddNoteRef?: React.MutableRefObject<(() => void) | null>;
  onOpenSettings?: () => void;
  onOpenCardTypes?: () => void;
  onFieldDefsSaved?: () => void;
  refreshToken?: number;
};

export function AnkiBrowse({
  courseId,
  courseTitle,
  hskLevel = null,
  defaultSection = "vocabulary",
  fieldDefsRaw,
  onMsg,
  onAddNoteRef,
  onOpenSettings,
  onOpenCardTypes,
  onFieldDefsSaved,
  refreshToken = 0,
}: Props) {
  const primarySection = (defaultSection ?? "vocabulary") as StudySectionId;

  const [localFieldDefsRaw, setLocalFieldDefsRaw] = useState<string | null>(fieldDefsRaw);
  const [fieldsDialogOpen, setFieldsDialogOpen] = useState(false);
  const [sectionFilter, setSectionFilter] = useState<string>(primarySection);
  const [subdecks, setSubdecks] = useState<string[]>([]);
  const [subdecksBySection, setSubdecksBySection] = useState<Record<string, string[]>>({});
  const [bySubdeck, setBySubdeck] = useState<Record<string, number>>({});
  const [cardState, setCardState] = useState("");
  const [search, setSearch] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(STUDY_SECTIONS.map((s) => [s.id, true])),
  );
  const [cards, setCards] = useState<FlashcardRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [bySection, setBySection] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fields, setFields] = useState<NoteFieldRow[]>([]);
  const [editSection, setEditSection] = useState<StudySectionId>(primarySection);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const pendingSelectRef = useRef<string | null>(null);
  const focusedFieldRef = useRef<NoteFieldRow | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);

  const selected = cards.find((c) => c.id === selectedId) ?? null;
  const selectedIndex = cards.findIndex((c) => c.id === selectedId);
  const activeBrowseSection = (sectionFilter || primarySection) as StudySectionId;
  const editorSection = (selected?.section ?? activeBrowseSection) as StudySectionId;
  const required = requiredFieldLabels(editorSection);
  const activePreset = getSectionPreset(activeBrowseSection);

  const activeFieldDefsRaw = useMemo(
    () =>
      fieldDefsRawForSection(
        editorSection,
        primarySection,
        fieldDefsRaw,
        localFieldDefsRaw,
      ),
    [editorSection, primarySection, fieldDefsRaw, localFieldDefsRaw],
  );

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
    setSubdecks(Array.isArray(data.subdecks) ? data.subdecks : []);
    setSubdecksBySection(data.subdecksBySection ?? {});
    setBySubdeck(data.bySubdeck ?? {});
  }, [courseId, sectionFilter, search, cardState]);

  useEffect(() => {
    void loadCards();
  }, [loadCards, refreshToken]);

  useEffect(() => {
    if (loading) return;
    if (dirty) return;
    if (pendingSelectRef.current) {
      const pending = pendingSelectRef.current;
      if (cards.some((c) => c.id === pending)) {
        setSelectedId(pending);
        pendingSelectRef.current = null;
        return;
      }
      return;
    }
    if (selectedId && cards.some((c) => c.id === selectedId)) return;
    if (cards.length > 0) setSelectedId(cards[0]!.id);
    else setSelectedId(null);
  }, [cards, loading, selectedId, dirty]);

  useEffect(() => {
    setLocalFieldDefsRaw(fieldDefsRaw);
  }, [fieldDefsRaw]);

  useEffect(() => {
    if (pendingSelectRef.current) return;
    if (!selected && !pendingSelectRef.current) {
      setFields(
        buildNoteFieldRows(
          {
            id: "",
            section: activeBrowseSection,
            front: "",
            back: "",
            pinyin: null,
            audioUrl: null,
            extraFields: null,
            sortOrder: 0,
          },
          activeFieldDefsRaw,
        ),
      );
      setEditSection(activeBrowseSection);
      return;
    }
    if (!selected) return;
    setFields(buildNoteFieldRows(selected, activeFieldDefsRaw));
    setEditSection(selected.section as StudySectionId);
    if (!pendingSelectRef.current) setDirty(false);
  }, [selected, activeFieldDefsRaw, activeBrowseSection]);

  const updateField = (key: string, value: string) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
    setDirty(true);
  };

  const attachImageToField = async (
    file: File,
    field: NoteFieldRow,
    selection?: { start: number; end: number },
  ) => {
    const asImageField = fieldUsesImageEditor(field.label, field.value, field.isImage);
    const asRich = usesRichEditorField(field.label, field.htmlEditor, field.multiline);
    if (!asImageField && !asRich && !field.multiline) {
      onMsg("Click vào trường ẢNH hoặc GHI CHÚ rồi paste");
      return;
    }
    setImageUploading(true);
    try {
      const uploaded = await uploadImageFile(file);
      const next = applyImageToFieldValue(field.value, uploaded, {
        isImageField: asImageField,
        multiline: field.multiline,
      }, selection);
      updateField(field.key, next);
      onMsg(`Đã thêm ảnh: ${uploaded.fileName}`);
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Không tải được ảnh");
    } finally {
      setImageUploading(false);
    }
  };

  const onFieldPaste = (
    e: React.ClipboardEvent,
    field: NoteFieldRow,
  ) => {
    const file = clipboardImageFile(e.clipboardData);
    if (!file) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLTextAreaElement | HTMLInputElement;
    const selection =
      "selectionStart" in el
        ? { start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length }
        : undefined;
    void attachImageToField(file, field, selection);
  };

  const onPickImageFile = (file: File | null) => {
    const field = focusedFieldRef.current;
    if (!file || !field) {
      if (!field) onMsg("Chọn trường cần chèn ảnh trước (click vào ô nhập)");
      return;
    }
    void attachImageToField(file, field);
  };

  const saveNote = async () => {
    const cardId = selected?.id ?? selectedId;
    if (!cardId) return;

    if (!selected && !pendingSelectRef.current) {
      onMsg("Thẻ không còn trong danh sách — đang tải lại…");
      setSelectedId(null);
      setDirty(false);
      await loadCards();
      return;
    }

    setSaving(true);
    const payload = noteFieldsToCardPayload(editSection, fields);
    const front = payload.front?.trim() ?? "";
    const back = payload.back?.trim() ?? "";
    if (!front && !back) {
      onMsg(`${required.front} hoặc ${required.back} cần có nội dung trước khi lưu`);
      setSaving(false);
      return;
    }
    const extras = payload.extraFields
      ? (JSON.parse(payload.extraFields) as Record<string, string>)
      : {};
    const res = await fetch(`/api/admin/courses/${courseId}/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, extraFields: extras }),
    });
    setSaving(false);
    if (res.ok) {
      pendingSelectRef.current = null;
      onMsg("Đã lưu thẻ");
      setDirty(false);
      await loadCards();
      setSelectedId(cardId);
      return;
    }
    if (res.status === 404) {
      onMsg("Thẻ không tồn tại (có thể đã bị xóa hoặc import lại) — đã tải lại danh sách");
      pendingSelectRef.current = null;
      setSelectedId(null);
      setDirty(false);
      await loadCards();
      return;
    }
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    onMsg(err.error ?? "Lỗi lưu thẻ");
  };

  const deleteNote = async () => {
    if (!selected || deleting) return;
    const label = selected.front || selected.back || "thẻ này";
    if (!window.confirm(`Xóa thẻ "${label}"? Hành động không hoàn tác.`)) return;

    setDeleting(true);
    const deletedId = selected.id;
    const res = await fetch(`/api/admin/courses/${courseId}/cards/${deletedId}`, {
      method: "DELETE",
    });
    setDeleting(false);

    if (!res.ok) {
      onMsg("Không xóa được thẻ");
      return;
    }

    onMsg("Đã xóa thẻ");
    setDirty(false);
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.delete(deletedId);
      return next;
    });
    setSelectedId(null);
    await loadCards();
  };

  const toggleChecked = (id: string, on?: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (on ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleCheckAll = () => {
    if (checkedIds.size === cards.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(cards.map((c) => c.id)));
    }
  };

  const deleteChecked = async () => {
    if (bulkDeleting || checkedIds.size === 0) return;
    const ids = [...checkedIds];
    if (!window.confirm(`Xóa ${ids.length} thẻ đã chọn? Hành động không hoàn tác.`)) return;

    setBulkDeleting(true);
    const res = await fetch(`/api/admin/courses/${courseId}/cards/bulk-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setBulkDeleting(false);

    if (!res.ok) {
      onMsg("Không xóa được các thẻ đã chọn");
      return;
    }

    const data = (await res.json()) as { deleted?: number };
    onMsg(`Đã xóa ${data.deleted ?? ids.length} thẻ`);
    setCheckedIds(new Set());
    setDirty(false);
    if (selectedId && ids.includes(selectedId)) setSelectedId(null);
    await loadCards();
  };

  const addNote = useCallback(async () => {
    const section = activeBrowseSection;
    setSearch("");
    setCardState("");
    setSidebarFilter("");

    const res = await fetch(`/api/admin/courses/${courseId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section,
        front: "",
        back: "",
        pinyin: "",
        extraFields: {},
      }),
    });
    let card: FlashcardRecord | null = null;
    try {
      card = (await res.json()) as FlashcardRecord;
    } catch {
      card = null;
    }
    if (res.ok && card?.id) {
      pendingSelectRef.current = card.id;
      setCheckedIds(new Set());
      onMsg("Đã thêm thẻ mới — điền nội dung bên phải rồi bấm Lưu");
      setSelectedId(card.id);
      setFields(buildNoteFieldRows(card, activeFieldDefsRaw));
      setEditSection(section);
      setDirty(true);
      await loadCards();
      pendingSelectRef.current = card.id;
      setDirty(true);
    } else {
      const err = card as unknown as { error?: string };
      onMsg(err?.error ?? "Không thêm được thẻ — thử reload trang");
    }
  }, [courseId, activeBrowseSection, loadCards, onMsg, activeFieldDefsRaw]);

  useEffect(() => {
    if (onAddNoteRef) onAddNoteRef.current = () => void addNote();
  }, [addNote, onAddNoteRef]);

  const pickSection = (sectionId: StudySectionId) => {
    setSectionFilter(sectionId);
    setCardState("");
    setSearch("");
    setCheckedIds(new Set());
  };

  const pickSubdeck = (sectionId: StudySectionId, subdeckName: string) => {
    setSectionFilter(sectionId);
    setCardState("");
    setSearch(`subdeck:"${subdeckName}"`);
    setCheckedIds(new Set());
  };

  const totalInCourse = useMemo(
    () => Object.values(bySection).reduce((sum, n) => sum + n, 0),
    [bySection],
  );

  const sidebarFilterLower = sidebarFilter.trim().toLowerCase();

  const sectionMatchesFilter = useCallback(
    (sectionId: StudySectionId) => {
      if (!sidebarFilterLower) return true;
      const s = STUDY_SECTIONS.find((x) => x.id === sectionId)!;
      const preset = getSectionPreset(sectionId);
      if (preset.noteTypeLabel.toLowerCase().includes(sidebarFilterLower)) return true;
      if (s.label.toLowerCase().includes(sidebarFilterLower)) return true;
      if (subdecksBySection[sectionId]?.some((sub) => sub.toLowerCase().includes(sidebarFilterLower))) {
        return true;
      }
      return false;
    },
    [sidebarFilterLower, subdecksBySection],
  );

  const subdeckMatchesFilter = useCallback(
    (name: string) => !sidebarFilterLower || name.toLowerCase().includes(sidebarFilterLower),
    [sidebarFilterLower],
  );

  const courseMatchesFilter =
    !sidebarFilterLower || courseTitle.toLowerCase().includes(sidebarFilterLower) || totalInCourse > 0;

  const showDeckTree =
    !sidebarFilterLower ||
    courseMatchesFilter ||
    STUDY_SECTIONS.some((s) => sectionMatchesFilter(s.id));

  const activeSubdeck = useMemo(() => {
    const m = search.match(/subdeck:"([^"]+)"/i);
    return m?.[1] ?? null;
  }, [search]);

  const pickSectionRow = (sectionId: StudySectionId) => {
    const subs = subdecksBySection[sectionId] ?? [];
    if (subs.length > 0) {
      setExpandedSections((p) => ({ ...p, [sectionId]: true }));
    }
    pickSection(sectionId);
  };

  const showAllInCourse = () => {
    setSectionFilter("");
    setCardState("");
    setSearch("");
    setCheckedIds(new Set());
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

  const previewFront =
    fields.find((f) => f.label === "Tiếng Trung" || f.label === "CHỮ HÁN" || f.key === "front")?.value ??
    selected?.front ??
    "";
  const previewBack =
    fields.find((f) => f.label === "Nghĩa tiếng Việt" || f.label === "NGHĨA" || f.key === "back")?.value ??
    selected?.back ??
    "";

  return (
    <>
    <div className="anki-win">
      <div className="anki-win-titlebar">
        Browse ({selectedIndex >= 0 ? selectedIndex + 1 : 0} of {total} notes selected)
      </div>

      <div className="anki-win-menubar">
        <Link href="/admin" className="anki-win-back">← Bảng quản trị</Link>
        <Link href={`/hoc/${courseId}`} className="anki-win-menu-btn anki-win-study-btn">
          ▶ Học thử
        </Link>
        <button type="button" className="anki-win-menu-btn" onClick={() => void addNote()}>
          + Thêm thẻ
        </button>
        <button type="button" className="anki-win-menu-btn" onClick={() => onOpenCardTypes?.() ?? onOpenSettings?.()}>
          Kiểu thẻ
        </button>
        <button type="button" className="anki-win-menu-btn" onClick={() => onOpenSettings?.()}>
          Mẫu thẻ
        </button>
        <span className="anki-win-menubar-title">{courseTitle}</span>
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

          {showDeckTree && (
            <AnkiBrowseDeckTree
              courseId={courseId}
              courseTitle={courseTitle}
              hskLevel={hskLevel}
              primarySection={primarySection}
              sidebarFilter={sidebarFilter}
              onShowAllInCourse={showAllInCourse}
            />
          )}
          </div>
        </aside>

        {/* CENTER — search + table */}
        <div className="anki-win-list-pane">
          <div className="anki-win-list-toolbar">
            <button type="button" className="anki-win-add-btn" onClick={() => void addNote()}>
              + Thêm thẻ
            </button>
            {checkedIds.size > 0 && (
              <button
                type="button"
                className="anki-win-bulk-delete"
                disabled={bulkDeleting}
                onClick={() => void deleteChecked()}
              >
                {bulkDeleting ? "Đang xóa…" : `Xóa đã chọn (${checkedIds.size})`}
              </button>
            )}
            <label className="anki-win-notes-toggle">
              <span className="anki-browse-section-tag">{activePreset.noteTypeLabel}</span>
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
            <div className="anki-win-empty-state">
              <p>Chưa có thẻ trong bộ này.</p>
              <button type="button" className="anki-win-add-btn large" onClick={() => void addNote()}>
                + Thêm thẻ đầu tiên
              </button>
              <p className="anki-win-empty-hint">
                Hoặc dùng tab <strong>Import Excel</strong> phía trên để import hàng loạt.
              </p>
            </div>
          ) : (
            <table className="anki-win-table">
              <colgroup>
                <col className="col-check" />
                <col className="col-sort" />
                <col className="col-type" />
                <col className="col-cards" />
                <col className="col-tags" />
              </colgroup>
              <thead>
                <tr>
                  <th className="col-check-h">
                    <input
                      type="checkbox"
                      checked={cards.length > 0 && checkedIds.size === cards.length}
                      onChange={toggleCheckAll}
                      title="Chọn tất cả"
                    />
                  </th>
                  <th>{sortFieldLabel(activeBrowseSection)}</th>
                  <th>Note Type</th>
                  <th className="col-cards-h">Cards</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr
                    key={c.id}
                    className={`${selectedId === c.id ? "sel" : ""} ${checkedIds.has(c.id) ? "checked" : ""}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td className="check-col" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checkedIds.has(c.id)}
                        onChange={() => toggleChecked(c.id)}
                      />
                    </td>
                    <td className="sort" title={sortFieldValue(c, c.section)}>
                      {sortFieldValue(c, c.section) || <span className="anki-empty-cell">(trống)</span>}
                    </td>
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
          {!selected && !pendingSelectRef.current ? (
            <div className="anki-win-empty-state">
              <p>Chưa chọn thẻ — hoặc tạo thẻ mới.</p>
              <button type="button" className="anki-win-add-btn large" onClick={() => void addNote()}>
                + Thêm thẻ
              </button>
            </div>
          ) : (
            <>
              <div className="anki-win-editor-top">
                <div className="anki-win-editor-top-left">
                  <button
                    type="button"
                    onClick={() => setFieldsDialogOpen(true)}
                    title="Quản lý trường dữ liệu (giống Anki Fields)"
                  >
                    Trường dữ liệu…
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenSettings?.()}
                    title="Chỉnh HTML/CSS hiển thị thẻ (giống Anki Cards template)"
                    className="anki-win-template-btn"
                  >
                    Mẫu thẻ (HTML/CSS)…
                  </button>
                  <button type="button" onClick={() => setPreviewOpen(true)}>Preview</button>
                </div>
                <div className="anki-win-editor-top-right">
                  <button type="button" onClick={() => void cardAction({ suspend: true })} title="Suspend">⏸</button>
                  <button type="button" onClick={() => void cardAction({ bury: true })} title="Bury">⊘</button>
                  <select
                    value={selected?.flag ?? 0}
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
                  <button
                    type="button"
                    className="anki-win-delete"
                    disabled={deleting}
                    onClick={() => void deleteNote()}
                    title="Xóa thẻ đang chọn"
                  >
                    {deleting ? "…" : "Xóa"}
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
                <button
                  type="button"
                  title="Chèn ảnh (hoặc Ctrl+V sau khi copy ảnh)"
                  disabled={imageUploading}
                  onClick={() => imageInputRef.current?.click()}
                >
                  🖼
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  tabIndex={-1}
                  onChange={(e) => {
                    onPickImageFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
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
                        {fieldUsesImageEditor(f.label, f.value, f.isImage) ? (
                          <AnkiImageField
                            value={f.value}
                            uploading={imageUploading && focusedFieldRef.current?.key === f.key}
                            onChange={(v) => updateField(f.key, v)}
                            onFocus={() => { focusedFieldRef.current = f; }}
                            onPaste={(e) => onFieldPaste(e, f)}
                          />
                        ) : usesRichEditor(f) ? (
                          <AnkiRichField
                            value={f.value}
                            uploading={imageUploading && focusedFieldRef.current?.key === f.key}
                            onChange={(v) => updateField(f.key, v)}
                            onFocus={() => { focusedFieldRef.current = f; }}
                            onUploadStart={() => setImageUploading(true)}
                            onUploadEnd={() => setImageUploading(false)}
                            onError={(msg) => onMsg(msg)}
                            placeholder="Gõ ghi chú — copy ảnh rồi Ctrl+V"
                            minHeight={
                              f.label === "VÍ DỤ" || f.label === "Đặt câu" || f.label === "ĐẶT CÂU" ? 120 : 88
                            }
                          />
                        ) : f.multiline ? (
                          <textarea
                            className={
                              f.label === "VÍ DỤ" ||
                              f.label === "Đặt câu" ||
                              f.label === "ĐẶT CÂU" ||
                              f.label === "GHI CHÚ"
                                ? "tall"
                                : ""
                            }
                            value={f.value}
                            onChange={(e) => updateField(f.key, e.target.value)}
                            onFocus={() => { focusedFieldRef.current = f; }}
                            onPaste={(e) => onFieldPaste(e, f)}
                            rows={f.label === "VÍ DỤ" || f.label === "Đặt câu" || f.label === "ĐẶT CÂU" ? 5 : 3}
                            placeholder={
                              f.placeholder ?? (f.multiline ? "Copy ảnh rồi Ctrl+V để chèn" : undefined)
                            }
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
                            onFocus={() => { focusedFieldRef.current = f; }}
                            onPaste={(e) => onFieldPaste(e, f)}
                            placeholder={f.placeholder}
                            style={{
                              fontFamily: f.fontFamily ?? "Segoe UI",
                              fontSize: f.fontSize ? `${f.fontSize}px` : undefined,
                              direction: f.rtl ? "rtl" : undefined,
                            }}
                          />
                        )}
                        {!fieldUsesImageEditor(f.label, f.value, f.isImage) && /<img\b/i.test(f.value) && fieldImagePreview(f.value) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={fieldImagePreview(f.value)!} alt="" className="img-inline" />
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

    {previewOpen && selectedId && (
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

function usesRichEditor(f: NoteFieldRow): boolean {
  return usesRichEditorField(f.label, f.htmlEditor, f.multiline);
}

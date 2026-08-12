"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_FIELD_SETTINGS,
  type FieldDefEntry,
  resolveFieldDefEntries,
  serializeFieldDefEntries,
} from "@/lib/field-defs";
import { REQUIRED_NOTE_FIELDS } from "@/lib/anki-note-fields";
import { AnkiFontPicker } from "./anki-font-picker";

type FieldSettings = Omit<FieldDefEntry, "name">;

type Props = {
  courseId: string;
  fieldDefsRaw: string | null | undefined;
  open: boolean;
  onClose: () => void;
  onSaved: (fieldDefsJson: string) => void;
};

function settingsFromEntries(entries: FieldDefEntry[]): Record<string, FieldSettings> {
  const map: Record<string, FieldSettings> = {};
  for (const e of entries) {
    const { name, ...rest } = e;
    map[name] = { ...DEFAULT_FIELD_SETTINGS, ...rest };
  }
  return map;
}

export function AnkiFieldsDialog({ courseId, fieldDefsRaw, open, onClose, onSaved }: Props) {
  const [fields, setFields] = useState<string[]>([]);
  const [settings, setSettings] = useState<Record<string, FieldSettings>>({});
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const entries = resolveFieldDefEntries(fieldDefsRaw);
      setFields(entries.map((e) => e.name));
      setSettings(settingsFromEntries(entries));
      setSelected(0);
    }
  }, [open, fieldDefsRaw]);

  const selectedName = fields[selected] ?? "";
  const current = settings[selectedName] ?? { ...DEFAULT_FIELD_SETTINGS };
  const isRequired = REQUIRED_NOTE_FIELDS.has(selectedName);

  const patchCurrent = useCallback(
    (patch: Partial<FieldSettings>) => {
      if (!selectedName) return;
      setSettings((prev) => ({
        ...prev,
        [selectedName]: { ...(prev[selectedName] ?? DEFAULT_FIELD_SETTINGS), ...patch },
      }));
    },
    [selectedName],
  );

  const renameSettingsKey = (oldName: string, newName: string) => {
    setSettings((prev) => {
      const next = { ...prev };
      if (next[oldName]) {
        next[newName] = next[oldName];
        delete next[oldName];
      }
      return next;
    });
  };

  if (!open) return null;

  const addField = () => {
    let base = "New Field";
    let n = 1;
    while (fields.includes(n === 1 ? base : `${base} ${n}`)) n++;
    const name = n === 1 ? base : `${base} ${n}`;
    setFields([...fields, name]);
    setSettings((prev) => ({ ...prev, [name]: { ...DEFAULT_FIELD_SETTINGS } }));
    setSelected(fields.length);
  };

  const deleteField = () => {
    if (!selectedName || isRequired) return;
    setFields(fields.filter((_, i) => i !== selected));
    setSettings((prev) => {
      const next = { ...prev };
      delete next[selectedName];
      return next;
    });
    setSelected(Math.max(0, selected - 1));
  };

  const renameField = () => {
    const next = window.prompt("Rename field:", selectedName);
    if (!next) return;
    const name = next.trim();
    if (!name || name === selectedName || fields.includes(name)) return;
    setFields(fields.map((f, i) => (i === selected ? name : f)));
    renameSettingsKey(selectedName, name);
  };

  const repositionField = () => {
    const raw = window.prompt(
      `Reposition "${selectedName}" — enter new position (1–${fields.length}):`,
      String(selected + 1),
    );
    if (!raw) return;
    const pos = parseInt(raw, 10);
    if (Number.isNaN(pos) || pos < 1 || pos > fields.length) return;
    const to = pos - 1;
    if (to === selected) return;
    const next = [...fields];
    const [item] = next.splice(selected, 1);
    next.splice(to, 0, item);
    setFields(next);
    setSelected(to);
  };

  const save = async () => {
    const entries: FieldDefEntry[] = fields.map((name) => ({
      name,
      ...(settings[name] ?? DEFAULT_FIELD_SETTINGS),
    }));
    const json = serializeFieldDefEntries(entries);
    setSaving(true);
    const res = await fetch(`/api/admin/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldDefs: entries }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved(json);
      onClose();
    }
  };

  return (
    <div className="anki-fields-overlay" onClick={onClose} role="presentation">
      <div className="anki-fields-win" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Fields">
        <div className="anki-fields-win-title">Fields for TỪ VỰNG HSK ( 9 CẤP )</div>

        <div className="anki-fields-win-body">
          <div className="anki-fields-top">
            <div className="anki-fields-listbox">
              {fields.map((f, i) => (
                <button
                  key={`${f}-${i}`}
                  type="button"
                  className={`anki-fields-listbox-item ${i === selected ? "sel" : ""}`}
                  style={{
                    fontFamily: settings[f]?.fontFamily ?? "Segoe UI",
                    fontSize: Math.min(14, (settings[f]?.fontSize ?? 12) * 0.65),
                  }}
                  onClick={() => setSelected(i)}
                  onDoubleClick={() => renameField()}
                >
                  {i + 1}: {f}
                </button>
              ))}
            </div>

            <div className="anki-fields-btns">
              <button type="button" onClick={addField}>Add</button>
              <button type="button" onClick={deleteField} disabled={isRequired}>Delete</button>
              <button type="button" onClick={renameField}>Rename</button>
              <button type="button" onClick={repositionField}>Reposition</button>
            </div>
          </div>

          <div className="anki-fields-options">
            <p className="anki-fields-section-title">Cài đặt trường đang chọn: {selectedName}</p>

            <div className="anki-fields-opt-row">
              <label htmlFor="field-desc">Description</label>
              <input
                id="field-desc"
                type="text"
                value={current.description ?? ""}
                onChange={(e) => patchCurrent({ description: e.target.value })}
                placeholder="Text to show inside the field when it's empty"
              />
            </div>

            <div className="anki-fields-opt-row anki-fields-font-row">
              <label htmlFor="field-font">Editing font</label>
              <div className="anki-fields-font-controls">
                <AnkiFontPicker
                  id="field-font"
                  value={current.fontFamily ?? "Arial"}
                  onChange={(fontFamily) => patchCurrent({ fontFamily })}
                />
                <input
                  type="number"
                  min={8}
                  max={72}
                  value={current.fontSize ?? 20}
                  onChange={(e) => patchCurrent({ fontSize: Number(e.target.value) || 20 })}
                  aria-label="Font size"
                />
              </div>
            </div>

            <div
              className="anki-fields-font-preview"
              style={{
                fontFamily: current.fontFamily ?? "Arial",
                fontSize: current.fontSize ?? 20,
                direction: current.rtl ? "rtl" : "ltr",
              }}
            >
              {selectedName || "Preview"} — 母亲 mǔqīn preview
            </div>

            <div className="anki-fields-checks">
              <label className="anki-fields-check">
                <input
                  type="checkbox"
                  checked={current.sortField ?? false}
                  onChange={(e) => patchCurrent({ sortField: e.target.checked })}
                />
                Sort by this field in the browser
              </label>
              <label className="anki-fields-check">
                <input
                  type="checkbox"
                  checked={current.rtl ?? false}
                  onChange={(e) => patchCurrent({ rtl: e.target.checked })}
                />
                Reverse text direction (RTL)
              </label>
              <label className="anki-fields-check">
                <input
                  type="checkbox"
                  checked={current.htmlEditor ?? false}
                  onChange={(e) => patchCurrent({ htmlEditor: e.target.checked })}
                />
                Use HTML editor by default
              </label>
              <label className="anki-fields-check">
                <input
                  type="checkbox"
                  checked={current.collapse ?? false}
                  onChange={(e) => patchCurrent({ collapse: e.target.checked })}
                />
                Collapse by default
              </label>
              <label className="anki-fields-check">
                <input
                  type="checkbox"
                  checked={current.excludeSearch ?? false}
                  onChange={(e) => patchCurrent({ excludeSearch: e.target.checked })}
                />
                Exclude from unqualified searches (slower)
              </label>
            </div>
          </div>
        </div>

        <div className="anki-fields-win-footer">
          <button type="button" className="anki-fields-btn-save" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="anki-fields-btn-help">Help</button>
        </div>
      </div>
    </div>
  );
}

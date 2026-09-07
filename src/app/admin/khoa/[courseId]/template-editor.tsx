"use client";

import { useState } from "react";
import {
  CARD_TYPE_LAYOUT_OPTIONS,
  defaultCardTypesForSection,
  parseAllCourseCardTypes,
  serializeCourseCardTypes,
  type CardTypeDef,
  type CardTypeLayout,
} from "@/lib/card-types";
import { getSectionPreset } from "@/lib/section-presets";

type Props = {
  courseId: string;
  primarySection?: string;
  cardTypesRaw?: string | null;
  onSaved: () => void;
  onOpenSectionTemplate?: () => void;
};

export function TemplateEditor({
  courseId,
  primarySection = "vocabulary",
  cardTypesRaw,
  onSaved,
  onOpenSectionTemplate,
}: Props) {
  const [types, setTypes] = useState<CardTypeDef[]>(() =>
    parseAllCourseCardTypes(cardTypesRaw, primarySection),
  );
  const [msg, setMsg] = useState("");

  const preset = getSectionPreset(primarySection);

  const updateType = (id: string, patch: Partial<CardTypeDef>) => {
    setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const save = async () => {
    const enabled = types.filter((t) => t.enabled !== false);
    if (enabled.length === 0) {
      setMsg("Phải bật ít nhất 1 kiểu thẻ");
      return;
    }
    const syncedTypes = types.map((t) => ({
      ...t,
      layout: t.layout === "custom" ? "default" : (t.layout ?? "default"),
    }));
    const res = await fetch(`/api/admin/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardTypes: serializeCourseCardTypes(syncedTypes),
      }),
    });
    if (res.ok) {
      setMsg("Đã lưu kiểu thẻ");
      onSaved();
    } else setMsg("Lỗi lưu kiểu thẻ");
  };

  const resetDefaults = () => {
    setTypes(defaultCardTypesForSection(primarySection));
    setMsg("Đã khôi phục kiểu thẻ mặc định — bấm Lưu để áp dụng");
  };

  return (
    <section className="rounded-xl border border-stone-200 p-6 bg-white space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Kiểu thẻ — {preset.noteTypeLabel}</h2>
          <p className="text-sm text-stone-600 mt-1">
            Bật/tắt chiều học (Việt→Trung, Trung→Việt…). Mẫu HTML/CSS chỉnh tại{" "}
            <strong>Bộ thẻ → 🎨 mẫu</strong> — một chỗ cho mọi bộ cùng loại (giống Anki Note Type).
          </p>
        </div>
        <button type="button" onClick={resetDefaults} className="text-xs text-stone-500 hover:underline">
          Khôi phục mặc định
        </button>
      </div>

      {onOpenSectionTemplate && (
        <button
          type="button"
          onClick={onOpenSectionTemplate}
          className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 px-4 py-2 text-sm hover:bg-emerald-100"
        >
          🎨 Mở mẫu hiển thị (HTML / CSS)
        </button>
      )}

      <div className="space-y-2">
        {types.map((t) => {
          const layoutOpt = CARD_TYPE_LAYOUT_OPTIONS.find((o) => o.id === (t.layout ?? "viet_trung"));
          return (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-3 border border-stone-100 rounded-lg px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={t.enabled !== false}
                onChange={(e) => updateType(t.id, { enabled: e.target.checked })}
                title="Bật kiểu thẻ"
              />
              <input
                className="flex-1 min-w-[120px] border border-stone-200 rounded px-2 py-1 text-sm"
                value={t.label}
                onChange={(e) => updateType(t.id, { label: e.target.value })}
              />
              <select
                className="border border-stone-200 rounded px-2 py-1 text-sm"
                value={t.layout ?? "default"}
                onChange={(e) => updateType(t.id, { layout: e.target.value as CardTypeLayout })}
              >
                {CARD_TYPE_LAYOUT_OPTIONS.filter((o) => o.id !== "custom").map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              {layoutOpt && <span className="text-xs text-stone-500">{layoutOpt.hint}</span>}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void save()}
        className="rounded-lg bg-stone-900 text-white px-4 py-2 text-sm"
      >
        Lưu kiểu thẻ
      </button>
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
    </section>
  );
}

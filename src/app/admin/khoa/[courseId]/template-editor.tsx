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
import { renderCardTemplate, toCardFields } from "@/lib/card-template";
import { getSectionPreset } from "@/lib/section-presets";
import { presetTemplatesForSection, sampleCardForSection } from "@/lib/section-templates";

type Props = {
  courseId: string;
  primarySection?: string;
  fieldNames?: string[];
  cardTypesRaw?: string | null;
  initial: {
    frontTemplate: string | null;
    backTemplate: string | null;
    cardCss: string | null;
  };
  onSaved: () => void;
};

export function TemplateEditor({
  courseId,
  primarySection = "vocabulary",
  fieldNames = [],
  cardTypesRaw,
  initial,
  onSaved,
}: Props) {
  const sectionDefaults = presetTemplatesForSection(primarySection);
  const hasOwnTemplate =
    !!initial.frontTemplate?.trim() || !!initial.backTemplate?.trim() || !!initial.cardCss?.trim();

  const [frontTemplate, setFrontTemplate] = useState(
    initial.frontTemplate?.trim() || sectionDefaults.frontTemplate,
  );
  const [backTemplate, setBackTemplate] = useState(
    initial.backTemplate?.trim() || sectionDefaults.backTemplate,
  );
  const [cardCss, setCardCss] = useState(initial.cardCss?.trim() || sectionDefaults.cardCss);
  const [types, setTypes] = useState<CardTypeDef[]>(() =>
    parseAllCourseCardTypes(cardTypesRaw, primarySection),
  );
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"front" | "back" | "css">("front");

  const preset = getSectionPreset(primarySection);
  const displayFields = fieldNames.length ? fieldNames : preset.fieldDefs.map((f) => f.name);
  const sampleCard = sampleCardForSection(primarySection);
  const fields = toCardFields(sampleCard);
  const previewFront = renderCardTemplate(frontTemplate, fields, "front");
  const previewBack = renderCardTemplate(backTemplate, fields, "back");

  const updateType = (id: string, patch: Partial<CardTypeDef>) => {
    setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const save = async () => {
    const enabled = types.filter((t) => t.enabled !== false);
    if (enabled.length === 0) {
      setMsg("Phải bật ít nhất 1 kiểu thẻ");
      return;
    }
    const res = await fetch(`/api/admin/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        frontTemplate,
        backTemplate,
        cardCss,
        cardTypes: serializeCourseCardTypes(types),
      }),
    });
    if (res.ok) {
      setMsg("Đã lưu mẫu thẻ và kiểu thẻ");
      onSaved();
    } else setMsg("Lỗi lưu mẫu thẻ");
  };

  const clearOverride = async () => {
    const res = await fetch(`/api/admin/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frontTemplate: "", backTemplate: "", cardCss: "" }),
    });
    if (res.ok) {
      setFrontTemplate(sectionDefaults.frontTemplate);
      setBackTemplate(sectionDefaults.backTemplate);
      setCardCss(sectionDefaults.cardCss);
      setMsg("Đã xóa template riêng — dùng mẫu chung theo mục học");
      onSaved();
    } else setMsg("Lỗi xóa template");
  };

  const resetDefaults = () => {
    setFrontTemplate(sectionDefaults.frontTemplate);
    setBackTemplate(sectionDefaults.backTemplate);
    setCardCss(sectionDefaults.cardCss);
    setTypes(defaultCardTypesForSection(primarySection));
    setMsg("Đã khôi phục mẫu mặc định — bấm Lưu để áp dụng");
  };

  return (
    <section className="rounded-xl border border-stone-200 p-6 bg-white space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Mẫu thẻ — {preset.noteTypeLabel}</h2>
          <p className="text-sm text-stone-600 mt-1">
            HTML/CSS hiển thị thẻ và kiểu thẻ khi học viên ôn (giống Anki Note Type).
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <button type="button" onClick={resetDefaults} className="text-stone-500 hover:underline">
            Khôi phục mặc định
          </button>
          {hasOwnTemplate && (
            <button type="button" onClick={() => void clearOverride()} className="text-amber-700 hover:underline">
              Xóa ghi đè → dùng mẫu chung
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-stone-600">
        Biến theo trường Browse:{" "}
        {displayFields.slice(0, 6).map((f) => (
          <code key={f} className="text-xs bg-stone-100 px-1 mr-1">{`{{${f}}}`}</code>
        ))}
        {displayFields.length > 6 && "…"}
      </p>

      <div className="flex gap-2 text-sm">
        {(["front", "back", "css"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1 border ${tab === t ? "bg-stone-900 text-white" : "bg-white"}`}
          >
            {t === "front" ? "Mặt trước" : t === "back" ? "Mặt sau" : "CSS"}
          </button>
        ))}
      </div>

      <textarea
        className="w-full font-mono text-xs border border-stone-200 rounded-lg p-3 min-h-[160px]"
        value={tab === "front" ? frontTemplate : tab === "back" ? backTemplate : cardCss}
        onChange={(e) => {
          if (tab === "front") setFrontTemplate(e.target.value);
          else if (tab === "back") setBackTemplate(e.target.value);
          else setCardCss(e.target.value);
        }}
        spellCheck={false}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-stone-500 mb-2">Xem trước mặt trước</p>
          <style>{cardCss}</style>
          <div
            className="border rounded-lg p-4 bg-stone-50 min-h-[120px]"
            dangerouslySetInnerHTML={{ __html: previewFront }}
          />
        </div>
        <div>
          <p className="text-xs text-stone-500 mb-2">Xem trước mặt sau</p>
          <style>{cardCss}</style>
          <div
            className="border rounded-lg p-4 bg-stone-50 min-h-[120px]"
            dangerouslySetInnerHTML={{ __html: previewBack }}
          />
        </div>
      </div>

      <div className="border-t border-stone-100 pt-4 space-y-3">
        <h3 className="text-sm font-semibold">Kiểu thẻ khi học</h3>
        <p className="text-xs text-stone-500">
          {primarySection === "vocabulary"
            ? "Từ vựng: bật Việt→Trung, Trung→Việt… Học viên thấy đúng chiều thẻ đã bật."
            : "Một kiểu thẻ theo mục học — chiều hiển thị mặt trước/sau."}
        </p>
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
      </div>

      <button
        type="button"
        onClick={() => void save()}
        className="rounded-lg bg-stone-900 text-white px-4 py-2 text-sm"
      >
        Lưu mẫu thẻ
      </button>
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
    </section>
  );
}

"use client";

import { Fragment, useMemo, useState } from "react";
import {
  CARD_TYPE_LAYOUT_OPTIONS,
  defaultCardTypesForSection,
  parseAllCourseCardTypes,
  serializeCourseCardTypes,
  type CardTypeDef,
  type CardTypeLayout,
} from "@/lib/card-types";
import { renderCardTemplate, resolveCardTypeTemplates, toCardFields } from "@/lib/card-template";
import { presetTemplatesForSection, sampleCardForSection } from "@/lib/section-templates";

type Props = {
  courseId: string;
  primarySection?: string;
  cardTypesRaw: string | null;
  baseTemplates: {
    frontTemplate: string | null;
    backTemplate: string | null;
    cardCss: string | null;
  };
  onSaved: () => void;
};

function slugId(label: string): string {
  const base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return base || `type_${Date.now()}`;
}

export function CardTypesEditor({
  courseId,
  primarySection = "vocabulary",
  cardTypesRaw,
  baseTemplates,
  onSaved,
}: Props) {
  const sectionDefaults = presetTemplatesForSection(primarySection);
  const resolvedBase = {
    frontTemplate: baseTemplates.frontTemplate?.trim() || sectionDefaults.frontTemplate,
    backTemplate: baseTemplates.backTemplate?.trim() || sectionDefaults.backTemplate,
    cardCss: baseTemplates.cardCss?.trim() || sectionDefaults.cardCss,
  };

  const [types, setTypes] = useState<CardTypeDef[]>(() =>
    parseAllCourseCardTypes(cardTypesRaw, primarySection),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const sampleCard = sampleCardForSection(primarySection);

  const updateType = (id: string, patch: Partial<CardTypeDef>) => {
    setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...types];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j]!, next[index]!];
    setTypes(next.map((t, i) => ({ ...t, ord: i })));
  };

  const removeType = (id: string) => {
    setTypes((prev) => prev.filter((t) => t.id !== id).map((t, i) => ({ ...t, ord: i })));
  };

  const addType = () => {
    const label = `Kiểu ${types.length + 1}`;
    const id = `${slugId(label)}_${types.length + 1}`;
    setTypes([
      ...types,
      {
        id,
        label,
        ord: types.length,
        enabled: true,
        layout: "viet_trung",
      },
    ]);
    setExpandedId(id);
  };

  const resetDefaults = () => {
    setTypes(defaultCardTypesForSection(primarySection));
    setMsg("Đã khôi phục kiểu thẻ mặc định — bấm Lưu để áp dụng");
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
      body: JSON.stringify({ cardTypes: serializeCourseCardTypes(types) }),
    });
    if (res.ok) {
      setMsg("Đã lưu kiểu thẻ — học viên sẽ thấy đúng loại thẻ đã bật");
      onSaved();
    } else setMsg("Lỗi lưu kiểu thẻ");
  };

  const preview = useMemo(() => {
    const first = types.find((t) => t.enabled !== false) ?? types[0];
    if (!first) return null;
    const tpl = resolveCardTypeTemplates(resolvedBase, first);
    const fields = toCardFields(sampleCard, first);
    return {
      label: first.label,
      front: renderCardTemplate(tpl.frontTemplate, fields, "front"),
      back: renderCardTemplate(tpl.backTemplate, fields, "back"),
      css: tpl.cardCss,
    };
  }, [types, resolvedBase, sampleCard]);

  return (
    <section className="rounded-xl border border-stone-200 p-6 bg-white space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Quản lý kiểu thẻ</h2>
          <p className="text-sm text-stone-600 mt-1">
            Giống Anki <strong>Manage Note Types → Cards</strong>: mỗi note có thể sinh nhiều kiểu thẻ khi học viên ôn.
          </p>
        </div>
        <button type="button" onClick={resetDefaults} className="text-xs text-stone-500 hover:underline">
          Khôi phục mặc định mục học
        </button>
      </div>

      <div className="overflow-x-auto border border-stone-100 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b bg-stone-50">
              <th className="py-2 px-3 w-10">Bật</th>
              <th className="py-2 px-3">Tên hiển thị</th>
              <th className="py-2 px-3">Cách hiển thị</th>
              <th className="py-2 px-3 w-24">Thứ tự</th>
              <th className="py-2 px-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {types.map((t, i) => {
              const layoutOpt = CARD_TYPE_LAYOUT_OPTIONS.find((o) => o.id === (t.layout ?? "viet_trung"));
              const isCustom = t.layout === "custom";
              return (
                <Fragment key={t.id}>
                  <tr className="border-b border-stone-50 align-top">
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={t.enabled !== false}
                        onChange={(e) => updateType(t.id, { enabled: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        className="w-full border border-stone-200 rounded px-2 py-1 text-sm"
                        value={t.label}
                        onChange={(e) => updateType(t.id, { label: e.target.value })}
                      />
                      <p className="text-[10px] text-stone-400 mt-0.5 font-mono">{t.id}</p>
                    </td>
                    <td className="py-2 px-3">
                      <select
                        className="w-full border border-stone-200 rounded px-2 py-1 text-sm"
                        value={t.layout ?? "viet_trung"}
                        onChange={(e) =>
                          updateType(t.id, { layout: e.target.value as CardTypeLayout })
                        }
                      >
                        {CARD_TYPE_LAYOUT_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {layoutOpt && (
                        <p className="text-xs text-stone-500 mt-1">{layoutOpt.hint}</p>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="px-1.5 py-0.5 border rounded text-xs"
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="px-1.5 py-0.5 border rounded text-xs"
                          disabled={i === types.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => removeType(t.id)}
                      >
                        Xóa
                      </button>
                      {isCustom && (
                        <button
                          type="button"
                          className="block text-xs text-emerald-700 hover:underline mt-1"
                          onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                        >
                          HTML
                        </button>
                      )}
                    </td>
                  </tr>
                  {isCustom && expandedId === t.id && (
                    <tr className="bg-stone-50">
                      <td colSpan={5} className="p-3 space-y-2">
                        <p className="text-xs text-stone-600">Template riêng cho kiểu thẻ này:</p>
                        <textarea
                          className="w-full font-mono text-xs border rounded p-2 min-h-[80px]"
                          placeholder="HTML mặt trước — {{Trường}}"
                          value={t.frontTemplate ?? ""}
                          onChange={(e) => updateType(t.id, { frontTemplate: e.target.value })}
                        />
                        <textarea
                          className="w-full font-mono text-xs border rounded p-2 min-h-[80px]"
                          placeholder="HTML mặt sau"
                          value={t.backTemplate ?? ""}
                          onChange={(e) => updateType(t.id, { backTemplate: e.target.value })}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addType}
        className="text-sm text-emerald-700 hover:underline"
      >
        + Thêm kiểu thẻ
      </button>

      {preview && (
        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
          <p className="sm:col-span-2 text-xs text-stone-500">
            Xem trước kiểu đầu tiên đang bật: <strong>{preview.label}</strong>
          </p>
          <div>
            <p className="text-xs text-stone-500 mb-1">Mặt trước</p>
            <style>{preview.css}</style>
            <div
              className="border rounded-lg p-3 bg-stone-50 min-h-[80px] text-sm"
              dangerouslySetInnerHTML={{ __html: preview.front }}
            />
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Mặt sau</p>
            <style>{preview.css}</style>
            <div
              className="border rounded-lg p-3 bg-stone-50 min-h-[80px] text-sm"
              dangerouslySetInnerHTML={{ __html: preview.back }}
            />
          </div>
        </div>
      )}

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

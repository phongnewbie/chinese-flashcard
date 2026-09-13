"use client";

import { useEffect, useState } from "react";
import { renderCardTemplate, toCardFields } from "@/lib/card-template";
import { getSectionPreset } from "@/lib/section-presets";
import {
  presetTemplatesForSection,
  sampleCardForSection,
  type SectionTemplateSet,
  type SectionStudyOptions,
} from "@/lib/section-templates";
import { defaultStudyOptionsForSection } from "@/lib/study-options";
import type { HskCategoryId } from "@/lib/hsk-levels";

type Props = {
  sectionId: HskCategoryId;
  label: string;
  onClose: () => void;
};

export function SectionTemplateEditor({ sectionId, label, onClose }: Props) {
  const defaults = presetTemplatesForSection(sectionId);
  const [frontTemplate, setFrontTemplate] = useState(defaults.frontTemplate);
  const [backTemplate, setBackTemplate] = useState(defaults.backTemplate);
  const [cardCss, setCardCss] = useState(defaults.cardCss);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"front" | "back" | "css" | "study">("front");
  const [studyOptions, setStudyOptions] = useState<SectionStudyOptions>(
    defaultStudyOptionsForSection(sectionId),
  );

  const preset = getSectionPreset(sectionId);
  const fieldNames = preset.fieldDefs.map((f) => f.name);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/section-templates")
      .then((r) => r.json())
      .then((json: {
        sections?: Record<string, SectionTemplateSet & { isCustom?: boolean; studyOptions?: SectionStudyOptions }>;
      }) => {
        if (cancelled) return;
        const row = json.sections?.[sectionId];
        if (row) {
          setFrontTemplate(row.frontTemplate);
          setBackTemplate(row.backTemplate);
          setCardCss(row.cardCss);
          setStudyOptions(row.studyOptions ?? defaultStudyOptionsForSection(sectionId));
          setIsCustom(!!row.isCustom);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  const sampleCard = sampleCardForSection(sectionId);
  const fields = toCardFields(sampleCard);
  const previewFront = renderCardTemplate(frontTemplate, fields, "front");
  const previewBack = renderCardTemplate(backTemplate, fields, "back");

  const save = async () => {
    const res = await fetch("/api/admin/section-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: sectionId, frontTemplate, backTemplate, cardCss, studyOptions }),
    });
    if (res.ok) {
      setIsCustom(true);
      setMsg("Đã lưu mẫu hiển thị cho mục này — áp dụng cho mọi bộ thẻ cùng loại");
    } else setMsg("Lỗi lưu mẫu");
  };

  const resetDefaults = async () => {
    const res = await fetch("/api/admin/section-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: sectionId, reset: true }),
    });
    if (res.ok) {
      const d = presetTemplatesForSection(sectionId);
      setFrontTemplate(d.frontTemplate);
      setBackTemplate(d.backTemplate);
      setCardCss(d.cardCss);
      setStudyOptions(defaultStudyOptionsForSection(sectionId));
      setIsCustom(false);
      setMsg("Đã khôi phục mẫu mặc định");
    } else setMsg("Lỗi khôi phục");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl border border-stone-200 bg-white p-6 shadow-xl my-8 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-lg">Mẫu thẻ (Note Type) — {label}</h2>
            <p className="text-sm text-stone-600 mt-1">
              <strong>Một chỗ duy nhất</strong> chỉnh mặt trước, mặt sau và CSS (cỡ chữ, màu…) cho{" "}
              <strong>tất cả bộ thẻ</strong> thuộc mục này.
              {isCustom ? (
                <span className="text-emerald-700"> · Đang dùng mẫu tùy chỉnh</span>
              ) : (
                <span> · Đang dùng mẫu mặc định</span>
              )}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-stone-500 hover:text-stone-800 text-xl leading-none">
            ×
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-stone-500">Đang tải…</p>
        ) : (
          <>
            <p className="text-sm text-stone-600">
              Biến:{" "}
              {fieldNames.slice(0, 6).map((f) => (
                <code key={f} className="text-xs bg-stone-100 px-1 mr-1">{`{{${f}}}`}</code>
              ))}
              {fieldNames.length > 6 && "…"} · Khối tuỳ chọn:{" "}
              <code className="text-xs bg-stone-100 px-1">{`{{#Trường}}...{{/Trường}}`}</code>
            </p>

            <div className="flex gap-2 text-sm flex-wrap">
              {(["front", "back", "css", "study"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-1 border ${
                    tab === t ? "bg-stone-900 text-white" : "bg-white"
                  }`}
                >
                  {t === "front"
                    ? "Mặt trước"
                    : t === "back"
                      ? "Mặt sau"
                      : t === "css"
                        ? "CSS"
                        : "Học thẻ"}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void resetDefaults()}
                className="ml-auto text-xs text-stone-500 hover:underline"
              >
                Khôi phục mặc định
              </button>
            </div>

            {tab === "study" ? (
              <div className="space-y-4 border border-stone-200 rounded-lg p-4 text-sm">
                <p className="text-stone-600">
                  Cài đặt âm thanh và nút gợi ý khi học thẻ (áp dụng mọi bộ thẻ cùng mục).
                </p>
                <label className="block space-y-1">
                  <span className="font-medium">Trì hoãn phát âm (ms)</span>
                  <input
                    type="number"
                    min={0}
                    max={5000}
                    step={100}
                    className="w-full border rounded-lg px-3 py-2"
                    value={studyOptions.audioDelayMs ?? 0}
                    onChange={(e) =>
                      setStudyOptions((o) => ({ ...o, audioDelayMs: Number(e.target.value) || 0 }))
                    }
                  />
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={studyOptions.audioWordFirst !== false}
                    onChange={(e) => setStudyOptions((o) => ({ ...o, audioWordFirst: e.target.checked }))}
                  />
                  Phát từ/chữ Hán trước, rồi đặt câu
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={studyOptions.audioExampleOnReveal !== false}
                    onChange={(e) =>
                      setStudyOptions((o) => ({ ...o, audioExampleOnReveal: e.target.checked }))
                    }
                  />
                  Tự đọc đặt câu khi hiện đáp án
                </label>
                <label className="block space-y-1">
                  <span className="font-medium">Trường gợi ý (phân cách dấu phẩy)</span>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 font-mono text-xs"
                    placeholder="CẤU TRÚC,CÁCH DÙNG"
                    value={studyOptions.hintFields ?? ""}
                    onChange={(e) => setStudyOptions((o) => ({ ...o, hintFields: e.target.value }))}
                  />
                  <span className="text-xs text-stone-500">
                    Ví dụ từ vựng: Nghĩa hán việt,Loại từ · Ngữ pháp: CẤU TRÚC,CÁCH DÙNG
                  </span>
                </label>
                <label className="block space-y-1">
                  <span className="font-medium">Nhãn nút gợi ý</span>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    value={studyOptions.hintLabel ?? "Gợi ý"}
                    onChange={(e) => setStudyOptions((o) => ({ ...o, hintLabel: e.target.value }))}
                  />
                </label>
              </div>
            ) : (
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
            )}

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

            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={() => void save()}
                className="rounded-lg bg-stone-900 text-white px-4 py-2 text-sm"
              >
                Lưu mẫu mục học
              </button>
              <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
                Đóng
              </button>
              {msg && <p className="text-sm text-emerald-700">{msg}</p>}
            </div>

            <p className="text-xs text-stone-500 border-t pt-3">
              Giống Anki: một Note Type cho mỗi mục (Từ vựng, Ngữ pháp…). Chỉnh HTML/CSS tại đây — mọi bộ thẻ cùng loại dùng chung.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

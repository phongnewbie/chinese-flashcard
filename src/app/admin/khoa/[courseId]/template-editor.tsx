"use client";

import { useState } from "react";
import {
  DEFAULT_BACK_TEMPLATE,
  DEFAULT_CARD_CSS,
  DEFAULT_FRONT_TEMPLATE,
  renderCardTemplate,
  toCardFields,
} from "@/lib/card-template";

type Props = {
  courseId: string;
  fieldNames?: string[];
  initial: {
    frontTemplate: string | null;
    backTemplate: string | null;
    cardCss: string | null;
  };
  onSaved: () => void;
};

export function TemplateEditor({ courseId, fieldNames = [], initial, onSaved }: Props) {
  const [frontTemplate, setFrontTemplate] = useState(
    initial.frontTemplate ?? DEFAULT_FRONT_TEMPLATE,
  );
  const [backTemplate, setBackTemplate] = useState(
    initial.backTemplate ?? DEFAULT_BACK_TEMPLATE,
  );
  const [cardCss, setCardCss] = useState(initial.cardCss ?? DEFAULT_CARD_CSS);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"front" | "back" | "css">("front");

  const sampleCard = {
    front: "你好",
    back: "Xin chào",
    pinyin: "nǐ hǎo",
    audioUrl: null as string | null,
    section: "vocabulary",
    extraFields: JSON.stringify(
      Object.fromEntries(
        fieldNames
          .filter((f) => !["Front", "Back", "Pinyin", "Audio"].includes(f))
          .map((f) => [f, `(mẫu ${f})`]),
      ),
    ),
  };

  const fields = toCardFields(sampleCard);
  const previewFront = renderCardTemplate(frontTemplate, fields, "front");
  const previewBack = renderCardTemplate(backTemplate, fields, "back");

  const save = async () => {
    const res = await fetch(`/api/admin/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frontTemplate, backTemplate, cardCss }),
    });
    if (res.ok) {
      setMsg("Đã lưu template thẻ");
      onSaved();
    } else setMsg("Lỗi lưu template");
  };

  const resetDefaults = () => {
    setFrontTemplate(DEFAULT_FRONT_TEMPLATE);
    setBackTemplate(DEFAULT_BACK_TEMPLATE);
    setCardCss(DEFAULT_CARD_CSS);
  };

  return (
    <section className="rounded-xl border border-stone-200 p-6 bg-white space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Template thẻ (giống Anki — chỉnh HTML/CSS)</h2>
        <button
          type="button"
          onClick={resetDefaults}
          className="text-xs text-stone-500 hover:underline"
        >
          Khôi phục mặc định
        </button>
      </div>

      <p className="text-sm text-stone-600">
        Dùng biến: <code className="text-xs bg-stone-100 px-1">{"{{Front}}"}</code>,{" "}
        <code className="text-xs bg-stone-100 px-1">{"{{Back}}"}</code>,{" "}
        <code className="text-xs bg-stone-100 px-1">{"{{Pinyin}}"}</code>,{" "}
        <code className="text-xs bg-stone-100 px-1">{"{{Audio}}"}</code> (mặt sau). Khối tuỳ chọn:{" "}
        <code className="text-xs bg-stone-100 px-1">{"{{#Pinyin}}...{{/Pinyin}}"}</code>
      </p>

      <div className="flex gap-2 text-sm">
        {(["front", "back", "css"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1 border ${
              tab === t ? "bg-stone-900 text-white" : "bg-white"
            }`}
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

      <button
        type="button"
        onClick={() => void save()}
        className="rounded-lg bg-stone-900 text-white px-4 py-2 text-sm"
      >
        Lưu template
      </button>
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
    </section>
  );
}

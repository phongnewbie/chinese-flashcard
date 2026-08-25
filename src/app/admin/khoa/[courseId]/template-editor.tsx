"use client";



import { useState } from "react";

import { renderCardTemplate, toCardFields } from "@/lib/card-template";

import { getSectionPreset } from "@/lib/section-presets";

import { presetTemplatesForSection, sampleCardForSection } from "@/lib/section-templates";



type Props = {

  courseId: string;

  primarySection?: string;

  fieldNames?: string[];

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

  const [msg, setMsg] = useState("");

  const [tab, setTab] = useState<"front" | "back" | "css">("front");



  const preset = getSectionPreset(primarySection);

  const displayFields = fieldNames.length ? fieldNames : preset.fieldDefs.map((f) => f.name);

  const sampleCard = sampleCardForSection(primarySection);

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

      setMsg("Đã lưu template riêng cho bộ thẻ này");

      onSaved();

    } else setMsg("Lỗi lưu template");

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

  };



  return (

    <section className="rounded-xl border border-stone-200 p-6 bg-white space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-2">

        <h2 className="font-semibold">Template thẻ riêng (ghi đè mẫu mục học)</h2>

        <div className="flex gap-3 text-xs">

          <button type="button" onClick={resetDefaults} className="text-stone-500 hover:underline">

            Khôi phục preset mục

          </button>

          {hasOwnTemplate && (

            <button type="button" onClick={() => void clearOverride()} className="text-amber-700 hover:underline">

              Xóa ghi đè → dùng mẫu chung

            </button>

          )}

        </div>

      </div>



      <p className="text-sm text-stone-600">

        Mục học: <strong>{preset.noteTypeLabel}</strong>. Dùng biến:{" "}

        {displayFields.slice(0, 5).map((f) => (

          <code key={f} className="text-xs bg-stone-100 px-1 mr-1">{`{{${f}}}`}</code>

        ))}

        {displayFields.length > 5 && "…"} · Khối tuỳ chọn:{" "}

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

        Lưu template riêng

      </button>

      {msg && <p className="text-sm text-emerald-700">{msg}</p>}

    </section>

  );

}


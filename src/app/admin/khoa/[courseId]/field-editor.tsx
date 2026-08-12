"use client";

import { useState } from "react";
import { resolveFieldDefs } from "@/lib/anki-note-fields";

type Props = {
  courseId: string;
  initial: string[];
  onSaved: () => void;
};

export function FieldDefsEditor({ courseId, initial, onSaved }: Props) {
  const [fields, setFields] = useState<string[]>(
    initial.length ? initial : resolveFieldDefs(null),
  );
  const [newField, setNewField] = useState("");
  const [msg, setMsg] = useState("");

  const add = () => {
    const name = newField.trim();
    if (!name || fields.includes(name)) return;
    setFields([...fields, name]);
    setNewField("");
  };

  const remove = (name: string) => {
    setFields(fields.filter((f) => f !== name));
  };

  const save = async () => {
    const res = await fetch(`/api/admin/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldDefs: fields }),
    });
    if (res.ok) {
      setMsg("Đã lưu danh sách trường");
      onSaved();
    } else setMsg("Lỗi lưu");
  };

  const allForTemplate = ["Front", "Back", "Pinyin", "Audio", ...fields];

  return (
    <section className="rounded-xl border border-stone-200 p-6 bg-white space-y-4">
      <h2 className="font-semibold">Trường dữ liệu (giống Anki Fields)</h2>
      <p className="text-sm text-stone-600">
        Trường chuẩn: <code className="text-xs">Front, Back, Pinyin, Audio</code>. Thêm trường tuỳ
        chỉnh (Ví dụ, Ghi chú, Hình ảnh…) — dùng trong template với{" "}
        <code className="text-xs">{"{{Tên trường}}"}</code>. Khi import Excel,{" "}
        <strong>cột thừa tự thành trường mới</strong> theo đúng tên cột.
      </p>

      <div className="flex flex-wrap gap-2">
        {fields.length === 0 ? (
          <span className="text-xs text-stone-400">Chưa có trường tuỳ chỉnh — import Excel sẽ tự thêm</span>
        ) : (
          fields.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-sm"
            >
              {f}
              <button
                type="button"
                onClick={() => remove(f)}
                className="text-stone-400 hover:text-red-600 ml-1"
                aria-label={`Xóa ${f}`}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm"
          placeholder="Tên trường mới, vd: Ví dụ"
          value={newField}
          onChange={(e) => setNewField(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button type="button" onClick={add} className="rounded-lg border px-4 py-2 text-sm">
          Thêm
        </button>
        <button
          type="button"
          onClick={() => void save()}
          className="rounded-lg bg-stone-900 text-white px-4 py-2 text-sm"
        >
          Lưu
        </button>
      </div>

      <p className="text-xs text-stone-500">
        Dùng trong template:{" "}
        {allForTemplate.map((f) => (
          <code key={f} className="bg-stone-50 px-1 mr-1">{`{{${f}}}`}</code>
        ))}
      </p>
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
    </section>
  );
}

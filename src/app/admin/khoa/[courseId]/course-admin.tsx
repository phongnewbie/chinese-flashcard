"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { importFieldNamesForSection } from "@/lib/section-presets";
import { sectionLabel, type StudySectionId } from "@/lib/sections";
import { type ImportPreview } from "@/lib/import-cards";
import { resolveFieldDefs } from "@/lib/anki-note-fields";
import { PersistenceBanner } from "@/components/persistence-banner";
import { ImportFileButton } from "@/app/admin/admin-ui";
import { TemplateEditor } from "./template-editor";
import { FieldDefsEditor } from "./field-editor";
import { CardTypesEditor } from "./card-types-editor";
import { AnkiBrowse } from "./anki-browse";
import Link from "next/link";

type Tab = "browse" | "import" | "settings";

type Course = {
  id: string;
  title: string;
  description: string | null;
  hskLevel: string | null;
  primarySection: string | null;
  frontTemplate: string | null;
  backTemplate: string | null;
  cardCss: string | null;
  fieldDefs: string | null;
  cardTypes: string | null;
};

export function CourseAdmin({ courseId }: { courseId: string }) {
  const [tab, setTab] = useState<Tab>("browse");
  const [course, setCourse] = useState<Course | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [msg, setMsg] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const addNoteRef = useRef<(() => void) | null>(null);

  const [browseRefresh, setBrowseRefresh] = useState(0);

  const reload = useCallback(async () => {
    setLoadError(null);
    const res = await fetch(`/api/admin/courses/${courseId}`, { cache: "no-store" });
    if (!res.ok) {
      setCourse(null);
      setLoadError(
        res.status === 404
          ? "Bộ thẻ không tồn tại (có thể đã xóa hoặc ID sai)."
          : "Không tải được bộ thẻ — thử refresh.",
      );
      return;
    }
    setCourse((await res.json()) as Course);
    setBrowseRefresh((n) => n + 1);
  }, [courseId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runPreview = async (file: File) => {
    setPreviewLoading(true);
    setPendingFile(file);
    setPreview(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("preview", "true");
    const res = await fetch(`/api/admin/courses/${courseId}/import`, { method: "POST", body: fd });
    let data: ImportPreview & { error?: string } = {} as ImportPreview & { error?: string };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      setPreviewLoading(false);
      setMsg("Không đọc được file (lỗi server)");
      setPendingFile(null);
      return;
    }
    setPreviewLoading(false);
    if (!res.ok) {
      setMsg(data.error ?? "Không đọc được file");
      setPendingFile(null);
      return;
    }
    setPreview(data as ImportPreview);
    setMsg("");
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    const fd = new FormData();
    fd.set("file", pendingFile);
    fd.set("mode", importMode);
    const res = await fetch(`/api/admin/courses/${courseId}/import`, { method: "POST", body: fd });
    let data: { error?: string; imported?: number; bySection?: Record<string, number> } = {};
    try {
      data = (await res.json()) as typeof data;
    } catch {
      setMsg("Import lỗi — server không phản hồi. Thử lại.");
      return;
    }
    if (res.ok) {
      const parts = data.bySection
        ? Object.entries(data.bySection as Record<string, number>)
            .map(([k, n]) => `${sectionLabel(k as StudySectionId)}: ${n}`)
            .join(", ")
        : "";
      setMsg(`Đã import ${data.imported} câu${parts ? ` (${parts})` : ""}`);
      setPreview(null);
      setPendingFile(null);
      reload();
      setTab("browse");
    } else setMsg(data.error ?? "Import lỗi");
  };

  if (loadError) {
    return (
      <div style={{ padding: 20, fontFamily: "Segoe UI", background: "#ece9e8", minHeight: "100vh" }}>
        <p style={{ color: "#b91c1c", marginBottom: 12 }}>{loadError}</p>
        <Link href="/admin" style={{ color: "#2563eb" }}>← Về bảng quản trị</Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ padding: 20, fontFamily: "Segoe UI", background: "#ece9e8", minHeight: "100vh" }}>
        Đang tải…
      </div>
    );
  }

  const importFields = importFieldNamesForSection(
    course.primarySection ?? "vocabulary",
    course.fieldDefs,
  );

  if (tab === "browse") {
    return (
      <div style={{ background: "#ece9e8", minHeight: "100vh", padding: 8 }}>
        <PersistenceBanner />
        <div className="anki-subnav" style={{ marginBottom: 6 }}>
          <button type="button" className="on">Browse / Nhập liệu</button>
          <button type="button" onClick={() => setTab("import")}>Import Excel</button>
          <button type="button" onClick={() => setTab("settings")}>Mẫu & kiểu thẻ</button>
          <Link href="/admin" style={{ marginLeft: "auto", fontSize: 11, alignSelf: "center" }}>
            ← Về bảng quản trị
          </Link>
        </div>
        {msg && <div className="anki-win-status">{msg}</div>}
        <AnkiBrowse
          courseId={courseId}
          courseTitle={course.title}
          hskLevel={course.hskLevel}
          defaultSection={(course.primarySection as StudySectionId | null) ?? "vocabulary"}
          fieldDefsRaw={course.fieldDefs}
          refreshToken={browseRefresh}
          onMsg={setMsg}
          onAddNoteRef={addNoteRef}
          onOpenSettings={() => setTab("settings")}
          onOpenCardTypes={() => setTab("settings")}
          onFieldDefsSaved={reload}
        />
      </div>
    );
  }

  return (
    <div style={{ background: "#ece9e8", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 8px 0" }}>
        <PersistenceBanner />
      </div>
      <div className="anki-subnav">
        <button type="button" onClick={() => setTab("browse")}>Browse / Nhập liệu</button>
        <button type="button" className={tab === "import" ? "on" : ""} onClick={() => setTab("import")}>Import Excel</button>
        <button type="button" className={tab === "settings" ? "on" : ""} onClick={() => setTab("settings")}>Mẫu & kiểu thẻ</button>
        <Link href="/admin" style={{ marginLeft: "auto", fontSize: 11, alignSelf: "center" }}>
          ← Về bảng quản trị
        </Link>
      </div>
      {msg && <div className="anki-win-status">{msg}</div>}
      <div className="anki-tab-panel">
        {tab === "import" && (
          <section className="space-y-4">
            <h2 className="font-semibold">Import Excel / Notepad</h2>
            <p className="text-sm text-stone-600">
              Hàng 1 của Excel phải là tiêu đề cột trùng với trường trong Browse. Thứ tự cột gợi ý:
              {" "}
              <strong>{importFields.join(" · ")}</strong>
            </p>
            <p className="text-sm text-stone-500">
              Âm thanh giống Anki — dán vào trường <strong>ÂM THANH</strong> (hoặc bất kỳ trường nào):
              {" "}
              <code className="text-xs">https://…/file.mp3</code>,{" "}
              <code className="text-xs">[sound:ten-file.mp3]</code>,{" "}
              <code className="text-xs">[sound:https://…/file.mp3]</code>
              {" "}hoặc upload MP3 rồi dùng tên file.
            </p>
            <div className="flex gap-4 text-sm">
              <label><input type="radio" checked={importMode === "append"} onChange={() => setImportMode("append")} /> Thêm</label>
              <label><input type="radio" checked={importMode === "replace"} onChange={() => setImportMode("replace")} /> Thay thế</label>
            </div>
            <ImportFileButton
              label="Import Excel / CSV"
              accept=".xlsx,.xls,.csv,.txt"
              onFile={(f) => void runPreview(f)}
            />
            {previewLoading && <p className="text-sm text-stone-500">Đang đọc file…</p>}
            {preview && (
              <div className="border rounded-lg p-4 space-y-3 bg-emerald-50/50">
                <p className="font-medium">Xem trước: {preview.total} câu</p>
                {preview.expectedFields?.length > 0 && (
                  <div className="text-sm">
                    <p className="text-stone-600 mb-1">Trường trong bộ thẻ:</p>
                    <p className="font-mono text-xs">{preview.expectedFields.join(" · ")}</p>
                  </div>
                )}
                {Object.keys(preview.columnMapping ?? {}).length > 0 ? (
                  <table className="text-sm w-full border-collapse">
                    <thead>
                      <tr className="text-left text-stone-500">
                        <th className="pr-4 pb-1">Cột Excel</th>
                        <th className="pb-1">→ Trường</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(preview.columnMapping).map(([excelCol, field]) => (
                        <tr key={excelCol}>
                          <td className="pr-4 py-0.5 font-mono text-xs">{excelCol}</td>
                          <td className="py-0.5">{field}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-amber-700">
                    Không khớp tiêu đề cột — dữ liệu được gán theo thứ tự cột (cột 1 = {preview.expectedFields?.[0] ?? "…"}).
                  </p>
                )}
                {preview.warnings?.length > 0 && (
                  <ul className="text-sm text-amber-700 list-disc pl-5">
                    {preview.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
                {preview.sample?.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-stone-600">Mẫu 3 dòng đầu</summary>
                    <ul className="mt-2 space-y-1 font-mono text-xs">
                      {preview.sample.slice(0, 3).map((c, i) => (
                        <li key={i}>
                          {c.front} · {c.pinyin ?? "—"} · {c.back}
                          {c.extraFields && Object.keys(c.extraFields).length > 0
                            ? ` · +${Object.keys(c.extraFields).length} trường`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <button type="button" className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm" onClick={() => void confirmImport()}>
                  Import {preview.total} câu
                </button>
              </div>
            )}

            <hr className="my-6" />
            <h2 className="font-semibold">Import Anki (.apkg)</h2>
            <p className="text-sm text-stone-600">
              Import note từ deck Anki (hỗ trợ Anki 2.1.50+). Tự nhận trường Front/Back hoặc Tiếng Trung/Nghĩa tiếng Việt.
            </p>
            <ImportFileButton
              label="Import file .apkg"
              accept=".apkg"
              onFile={async (f) => {
                setMsg("Đang import apkg...");
                try {
                  const fd = new FormData();
                  fd.set("file", f);
                  const res = await fetch(`/api/admin/courses/${courseId}/import-apkg`, { method: "POST", body: fd });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok) {
                    const mediaNote = data.mediaImported ? ` · ${data.mediaImported} file âm thanh` : "";
                    setMsg(`Đã import ${data.imported} note từ apkg${mediaNote}`);
                    reload();
                    setTab("browse");
                  } else {
                    setMsg(data.error ?? "Import apkg lỗi");
                  }
                } catch {
                  setMsg("Import apkg lỗi — kiểm tra kết nối mạng");
                }
              }}
            />

            <hr className="my-6" />
            <h2 className="font-semibold">Export CSV</h2>
            <a
              href={`/api/admin/courses/${courseId}/export`}
              className="inline-block rounded-lg bg-stone-800 text-white px-4 py-2 text-sm"
            >
              Tải CSV
            </a>
          </section>
        )}
        {tab === "settings" && (
          <div className="space-y-6">
            <p className="text-sm text-stone-600 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
              Giống Anki: <strong>Tools → Manage Note Types → Cards</strong> — chỉnh HTML/CSS mặt trước, mặt sau và
              style thẻ cho bộ <strong>{course.title}</strong>.
            </p>
            <FieldDefsEditor courseId={courseId} initial={resolveFieldDefs(course.fieldDefs)} onSaved={reload} />
            <CardTypesEditor
              courseId={courseId}
              primarySection={course.primarySection ?? "vocabulary"}
              cardTypesRaw={course.cardTypes}
              baseTemplates={{
                frontTemplate: course.frontTemplate,
                backTemplate: course.backTemplate,
                cardCss: course.cardCss,
              }}
              onSaved={reload}
            />
            <TemplateEditor
              key={`tpl-${course.id}-${course.frontTemplate?.length ?? 0}-${course.backTemplate?.length ?? 0}`}
              courseId={courseId}
              primarySection={course.primarySection ?? "vocabulary"}
              initial={{ frontTemplate: course.frontTemplate, backTemplate: course.backTemplate, cardCss: course.cardCss }}
              fieldNames={resolveFieldDefs(course.fieldDefs)}
              onSaved={reload}
            />
          </div>
        )}
      </div>
    </div>
  );
}

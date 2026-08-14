"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  categoriesForLevel,
  categoryLabel,
  HSK_LEVELS,
  type HskCategoryId,
} from "@/lib/hsk-levels";

type Enrollment = { id: string; userId: string; email: string; name: string | null };
type LessonCourse = {
  id: string;
  title: string;
  hskLevel: string | null;
  primarySection: string | null;
  lessonNumber: number | null;
  _count: { cards: number };
};

export function HskAdminBoard() {
  const [usersByLevel, setUsersByLevel] = useState<Record<string, Enrollment[]>>({});
  const [coursesByLevel, setCoursesByLevel] = useState<Record<string, LessonCourse[]>>({});
  const [msg, setMsg] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addLevel, setAddLevel] = useState<string>("hsk1");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/hsk-board")
      .then((r) => r.json())
      .then((data) => {
        setUsersByLevel(data.usersByLevel ?? {});
        setCoursesByLevel(data.coursesByLevel ?? {});
      })
      .catch(() => setMsg("Không tải được bảng quản trị"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addUser = async () => {
    if (!addEmail.trim()) return;
    const res = await fetch("/api/admin/hsk-board/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: addEmail, hskLevel: addLevel }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMsg(data.error ?? "Không thêm được");
      return;
    }
    setAddEmail("");
    setMsg(`Đã thêm ${addEmail} vào ${addLevel}`);
    reload();
  };

  const removeUser = async (id: string) => {
    await fetch(`/api/admin/hsk-board/enrollments/${id}`, { method: "DELETE" });
    reload();
  };

  const addLesson = async (hskLevel: string, primarySection: HskCategoryId) => {
    const res = await fetch("/api/admin/hsk-board/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hskLevel, primarySection }),
    });
    if (res.ok) {
      setMsg(`Đã thêm bài mới — ${hskLevel} / ${categoryLabel(primarySection)}`);
      reload();
    } else {
      const data = (await res.json()) as { error?: string };
      setMsg(data.error ?? "Không tạo được bài");
    }
  };

  if (loading) {
    return <p className="text-stone-500">Đang tải bảng HSK…</p>;
  }

  return (
    <div className="space-y-8">
      {msg && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {msg}
        </p>
      )}

      {/* Quản lý tài khoản */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg">Quản lý tài khoản</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Admin thêm email khách vào từng cấp HSK (không duyệt đăng ký)
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="email"
              placeholder="email@gmail.com"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm min-w-[200px]"
            />
            <select
              value={addLevel}
              onChange={(e) => setAddLevel(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              {HSK_LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void addUser()}
              className="rounded-lg bg-amber-400 hover:bg-amber-500 text-stone-900 font-semibold px-4 py-2 text-sm"
            >
              + thêm
            </button>
          </div>
        </div>

        <div className="hsk-board-scroll overflow-x-auto pb-2">
          <div className="hsk-board-grid min-w-[980px]">
            {HSK_LEVELS.map((level) => (
              <div key={level.id} className="hsk-board-col">
                <div className="hsk-board-col-head">{level.label}</div>
                <ul className="hsk-board-col-body space-y-1">
                  {(usersByLevel[level.id] ?? []).map((u) => (
                    <li key={u.id} className="hsk-board-email group">
                      <span className="truncate">{u.email}</span>
                      <button
                        type="button"
                        onClick={() => void removeUser(u.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 text-xs shrink-0"
                        title="Gỡ"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                  {(usersByLevel[level.id] ?? []).length === 0 && (
                    <li className="text-xs text-stone-400 italic py-2">Chưa có</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Thêm bộ thẻ */}
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-lg">Thêm bộ thẻ</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Mỗi cấp có từ vựng, ngữ pháp, sắp xếp câu, giao tiếp — bấm + để thêm Bài 1, 2, 3…
          </p>
        </div>

        <div className="hsk-board-scroll overflow-x-auto pb-2">
          <div className="hsk-board-grid min-w-[980px]">
            {HSK_LEVELS.map((level) => (
              <div key={level.id} className="hsk-board-col">
                <div className="hsk-board-col-head">{level.label}</div>
                <div className="hsk-board-col-body space-y-3">
                  {categoriesForLevel(level.id).map((cat) => {
                    const lessons = (coursesByLevel[level.id] ?? []).filter(
                      (c) => c.primarySection === cat.id,
                    );
                    return (
                      <div key={cat.id} className="hsk-board-category">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium text-stone-800">{cat.label}</span>
                          <button
                            type="button"
                            onClick={() => void addLesson(level.id, cat.id)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            + bài
                          </button>
                        </div>
                        <ul className="mt-1 space-y-0.5">
                          {lessons.map((c) => (
                            <li key={c.id}>
                              <Link
                                href={`/admin/khoa/${c.id}`}
                                className="text-xs text-stone-600 hover:text-emerald-700 hover:underline block truncate"
                              >
                                Bài {c.lessonNumber ?? "?"} ({c._count.cards} thẻ)
                              </Link>
                            </li>
                          ))}
                          {lessons.length === 0 && (
                            <li className="text-[11px] text-stone-400">Chưa có bài</li>
                          )}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

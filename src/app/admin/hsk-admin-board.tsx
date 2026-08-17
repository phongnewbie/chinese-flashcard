"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  categoriesForLevel,
  HSK_LEVELS,
  type HskCategoryId,
} from "@/lib/hsk-levels";
import {
  AdminAlert,
  AdminBtnDanger,
  AdminBtnPrimary,
  AdminCard,
  AdminEmpty,
  AdminLoading,
  AdminSectionHeader,
  AdminToolbar,
  adminInputClass,
} from "./admin-ui";

type Enrollment = { id: string; userId: string; email: string; name: string | null };
type LessonCourse = {
  id: string;
  title: string;
  hskLevel: string | null;
  primarySection: string | null;
  lessonNumber: number | null;
  _count: { cards: number };
};

function LevelTabs({
  active,
  onChange,
}: {
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="admin-level-tabs" role="tablist" aria-label="Cấp HSK">
      {HSK_LEVELS.map((level) => (
        <button
          key={level.id}
          type="button"
          role="tab"
          aria-selected={active === level.id}
          className={`admin-level-tab ${active === level.id ? "admin-level-tab-active" : ""}`}
          onClick={() => onChange(level.id)}
        >
          {level.label}
        </button>
      ))}
    </div>
  );
}

function useHskBoardData() {
  const [usersByLevel, setUsersByLevel] = useState<Record<string, Enrollment[]>>({});
  const [coursesByLevel, setCoursesByLevel] = useState<Record<string, LessonCourse[]>>({});
  const [msg, setMsg] = useState("");
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

  return { usersByLevel, coursesByLevel, msg, setMsg, loading, reload };
}

export function HskAccountsSection() {
  const { usersByLevel, msg, setMsg, loading, reload } = useHskBoardData();
  const [addEmail, setAddEmail] = useState("");
  const [addLevel, setAddLevel] = useState("hsk1");
  const [activeLevel, setActiveLevel] = useState("hsk1");

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
    setActiveLevel(addLevel);
    reload();
  };

  const removeUser = async (id: string) => {
    await fetch(`/api/admin/hsk-board/enrollments/${id}`, { method: "DELETE" });
    reload();
  };

  if (loading) return <AdminLoading />;

  const users = usersByLevel[activeLevel] ?? [];

  return (
    <div className="admin-tab-content">
      <AdminAlert>{msg}</AdminAlert>

      <AdminCard>
        <AdminSectionHeader
          title="Quản lý tài khoản"
          description="Gán email khách vào từng cấp HSK — không cần duyệt đăng ký"
        />

        <AdminToolbar>
          <input
            type="email"
            placeholder="email@gmail.com"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            className={adminInputClass("admin-input-grow")}
          />
          <select
            value={addLevel}
            onChange={(e) => setAddLevel(e.target.value)}
            className={adminInputClass("admin-input-select")}
          >
            {HSK_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <AdminBtnPrimary onClick={() => void addUser()}>+ Thêm email</AdminBtnPrimary>
        </AdminToolbar>

        <div className="admin-divider" />

        <p className="admin-subheading">Danh sách theo cấp</p>
        <LevelTabs active={activeLevel} onChange={setActiveLevel} />

        <ul className="admin-list">
          {users.map((u) => (
            <li key={u.id} className="admin-list-item">
              <span className="admin-list-text">{u.email}</span>
              <AdminBtnDanger onClick={() => void removeUser(u.id)}>Gỡ</AdminBtnDanger>
            </li>
          ))}
          {users.length === 0 && (
            <AdminEmpty>Chưa có email ở cấp {activeLevel.toUpperCase()}</AdminEmpty>
          )}
        </ul>
      </AdminCard>
    </div>
  );
}

export function HskCardsSection() {
  const { coursesByLevel, msg, setMsg, loading, reload } = useHskBoardData();
  const [activeLevel, setActiveLevel] = useState("hsk1");
  const [draft, setDraft] = useState<{ category: HskCategoryId; title: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  const addLesson = async (hskLevel: string, primarySection: HskCategoryId, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      setMsg("Vui lòng nhập tên bộ thẻ");
      return;
    }
    const res = await fetch("/api/admin/hsk-board/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hskLevel, primarySection, title: trimmed }),
    });
    if (res.ok) {
      setMsg(`Đã tạo bộ thẻ "${trimmed}"`);
      setDraft(null);
      reload();
    } else {
      const data = (await res.json()) as { error?: string };
      setMsg(data.error ?? "Không tạo được bộ thẻ");
    }
  };

  const renameLesson = async (courseId: string) => {
    const trimmed = renameTitle.trim();
    if (!trimmed) {
      setMsg("Tên bộ thẻ không được để trống");
      return;
    }
    const res = await fetch(`/api/admin/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    if (res.ok) {
      setMsg(`Đã đổi tên thành "${trimmed}"`);
      setRenamingId(null);
      setRenameTitle("");
      reload();
    } else {
      setMsg("Không đổi tên được");
    }
  };

  const deleteLesson = async (courseId: string, title: string) => {
    if (!confirm(`Xóa bộ thẻ "${title}"? Toàn bộ thẻ bên trong cũng bị xóa.`)) return;
    const res = await fetch(`/api/admin/courses/${courseId}`, { method: "DELETE" });
    if (res.ok) {
      setMsg(`Đã xóa "${title}"`);
      reload();
    } else {
      setMsg("Không xóa được bộ thẻ");
    }
  };

  if (loading) return <AdminLoading />;

  const levelCourses = coursesByLevel[activeLevel] ?? [];

  return (
    <div className="admin-tab-content">
      <AdminAlert>{msg}</AdminAlert>

      <AdminCard>
        <AdminSectionHeader
          title="Bộ thẻ / Bài học"
          description="7 cấp HSK cố định — tự tạo và đặt tên bộ thẻ tùy ý trong từng danh mục"
        />

        <LevelTabs active={activeLevel} onChange={setActiveLevel} />

        <div className="admin-category-grid">
          {categoriesForLevel(activeLevel).map((cat) => {
            const lessons = levelCourses.filter((c) => c.primarySection === cat.id);
            const isAdding = draft?.category === cat.id;
            return (
              <div key={cat.id} className="admin-category-box">
                <div className="admin-category-head">
                  <span>{cat.label}</span>
                  {!isAdding && (
                    <button
                      type="button"
                      onClick={() => setDraft({ category: cat.id, title: "" })}
                      className="admin-link-btn"
                    >
                      + thêm bộ thẻ
                    </button>
                  )}
                </div>

                {isAdding && (
                  <div className="admin-add-deck-form">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Tên bộ thẻ (VD: Bài 1, Unit 2, Ôn tập...)"
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void addLesson(activeLevel, cat.id, draft.title);
                        }
                        if (e.key === "Escape") setDraft(null);
                      }}
                      className={adminInputClass()}
                    />
                    <div className="admin-add-deck-actions">
                      <AdminBtnPrimary
                        onClick={() => void addLesson(activeLevel, cat.id, draft.title)}
                      >
                        Tạo
                      </AdminBtnPrimary>
                      <button
                        type="button"
                        className="admin-link-btn"
                        onClick={() => setDraft(null)}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}

                <ul className="admin-lesson-list">
                  {lessons.map((c) => (
                    <li key={c.id} className="admin-deck-row">
                      {renamingId === c.id ? (
                        <div className="admin-add-deck-form admin-add-deck-form-inline">
                          <input
                            type="text"
                            autoFocus
                            value={renameTitle}
                            onChange={(e) => setRenameTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void renameLesson(c.id);
                              if (e.key === "Escape") {
                                setRenamingId(null);
                                setRenameTitle("");
                              }
                            }}
                            className={adminInputClass()}
                          />
                          <div className="admin-add-deck-actions">
                            <AdminBtnPrimary onClick={() => void renameLesson(c.id)}>
                              Lưu
                            </AdminBtnPrimary>
                            <button
                              type="button"
                              className="admin-link-btn"
                              onClick={() => {
                                setRenamingId(null);
                                setRenameTitle("");
                              }}
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Link href={`/admin/khoa/${c.id}`} className="admin-lesson-link admin-lesson-link-primary">
                            {c.title} · {c._count.cards} thẻ → Nhập liệu
                          </Link>
                          <div className="admin-deck-actions">
                            <button
                              type="button"
                              className="admin-link-btn"
                              onClick={() => {
                                setRenamingId(c.id);
                                setRenameTitle(c.title);
                              }}
                            >
                              Sửa tên
                            </button>
                            <AdminBtnDanger onClick={() => void deleteLesson(c.id, c.title)}>
                              Xóa
                            </AdminBtnDanger>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {lessons.length === 0 && !isAdding && (
                    <li className="admin-lesson-empty">Chưa có bộ thẻ</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </AdminCard>
    </div>
  );
}

export function HskAdminBoard() {
  return (
    <div className="space-y-8">
      <HskAccountsSection />
      <HskCardsSection />
    </div>
  );
}

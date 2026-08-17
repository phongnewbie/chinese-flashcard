"use client";

import Link from "next/link";
import {
  categoriesForLevel,
  HSK_LEVELS,
} from "@/lib/hsk-levels";
import { LockScreen, TrialBanner, useAccess } from "@/components/access-ui";

type LessonCourse = {
  id: string;
  title: string;
  hskLevel: string | null;
  primarySection: string | null;
  lessonNumber: number | null;
  _count: { cards: number };
};

export function HskStudentBoard({
  courses,
  isAdmin = false,
}: {
  courses: LessonCourse[];
  isAdmin?: boolean;
}) {
  const { access, loading } = useAccess();
  const locked = !loading && access != null && !access.allowed;
  const canStudy = isAdmin || (access?.allowed ?? false);

  const coursesByLevel: Record<string, LessonCourse[]> = {};
  for (const level of HSK_LEVELS) {
    coursesByLevel[level.id] = courses.filter((c) => c.hskLevel === level.id);
  }

  if (loading) {
    return <p className="text-stone-500 text-sm">Đang tải...</p>;
  }

  return (
    <div className="space-y-6">
      <TrialBanner />

      {locked && access && (
        <div className="space-y-4">
          <LockScreen access={access} />
          <p className="text-center text-sm text-stone-500">
            Các bài học bên dưới đã bị khóa — liên hệ Zalo để mở khóa toàn bộ.
          </p>
        </div>
      )}

      {isAdmin && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          Bạn là <strong>admin</strong> — thấy đủ 7 cấp HSK. Quản lý thẻ:{" "}
          <Link href="/admin" className="font-semibold underline">
            Quản trị
          </Link>
        </div>
      )}

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
                      <div className="font-medium text-stone-800">{cat.label}</div>
                      <ul className="mt-1 space-y-0.5">
                        {lessons.map((c) => (
                          <li key={c.id}>
                            {canStudy ? (
                              <Link
                                href={`/hoc/${c.id}`}
                                className="text-xs text-stone-600 hover:text-emerald-700 hover:underline block truncate"
                              >
                                {c.title} ({c._count.cards} thẻ)
                              </Link>
                            ) : (
                              <span
                                className="text-xs text-stone-400 block truncate cursor-not-allowed"
                                title="Đã hết thời gian học thử"
                              >
                                🔒 {c.title} ({c._count.cards} thẻ)
                              </span>
                            )}
                            {isAdmin && (
                              <Link
                                href={`/admin/khoa/${c.id}`}
                                className="text-[10px] text-stone-400 hover:text-stone-700 underline"
                              >
                                Browse
                              </Link>
                            )}
                          </li>
                        ))}
                        {lessons.length === 0 && (
                          <li className="text-[11px] text-stone-400 italic">Chưa có bài</li>
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
    </div>
  );
}

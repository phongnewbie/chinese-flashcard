"use client";

import Link from "next/link";
import { isAccessLocked, useAccess, LockScreen } from "@/components/access-ui";

type Course = {
  id: string;
  title: string;
  description: string | null;
  _count: { cards: number };
};

export function StudentCourseList({
  courses,
  isAdmin = false,
}: {
  courses: Course[];
  isAdmin?: boolean;
}) {
  const { access, loading } = useAccess();

  if (loading) {
    return <p className="text-stone-500 text-sm">Đang tải...</p>;
  }

  if (isAccessLocked(access)) {
    return <LockScreen access={access!} />;
  }

  if (courses.length === 0) {
    return (
      <p className="text-stone-500 text-sm rounded-xl border border-dashed border-stone-200 p-8 text-center">
        Chưa có bài học. Admin cần thêm email của bạn vào cấp HSK và tạo bài trên bảng quản trị.
      </p>
    );
  }

  return (
    <ul className="grid gap-4">
      {isAdmin && (
        <li className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          Bạn là <strong>admin</strong>. Để quản lý thẻ kiểu Anki Browse, bấm{" "}
          <strong>Quản trị (Browse)</strong> — không phải nút học thường.
        </li>
      )}
      {courses.map((c) => (
        <li key={c.id} className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-stone-900">{c.title}</h2>
          {c.description && (
            <p className="text-sm text-stone-600 mt-1">{c.description}</p>
          )}
          <p className="text-xs text-stone-400 mt-2">{c._count.cards} thẻ</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link
              href={`/hoc/${c.id}`}
              className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700"
            >
              Học thử (học viên)
            </Link>
            {isAdmin && (
              <Link
                href={`/admin/khoa/${c.id}`}
                className="rounded-lg bg-stone-800 text-white px-4 py-2 text-sm font-medium hover:bg-stone-900"
              >
                Quản trị (Browse Anki)
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

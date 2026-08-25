"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { STUDENT_PREVIEW_COOKIE } from "@/lib/student-preview";

function readPreviewFromCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c === `${STUDENT_PREVIEW_COOKIE}=1`);
}

function writePreviewCookie(on: boolean) {
  const value = on ? "1" : "0";
  document.cookie = `${STUDENT_PREVIEW_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  try {
    localStorage.setItem(STUDENT_PREVIEW_COOKIE, value);
  } catch {
    /* ignore */
  }
}

export function StudentPreviewBar({ showAdminExit = true }: { showAdminExit?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [on, setOn] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get("preview") === "1";
    if (fromUrl) {
      writePreviewCookie(true);
      setOn(true);
      if (pathname !== "/hoc") {
        router.replace("/hoc?preview=1");
      } else {
        router.replace("/hoc");
      }
      router.refresh();
      return;
    }
    setOn(readPreviewFromCookie());
  }, [searchParams, router, pathname]);

  const toggle = useCallback(
    (next: boolean) => {
      writePreviewCookie(next);
      setOn(next);
      router.refresh();
    },
    [router],
  );

  if (!on) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 flex flex-wrap items-center justify-between gap-2">
        <span>Xem app hoạt động đúng như học viên thấy</span>
        <button
          type="button"
          onClick={() => toggle(true)}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white text-sm font-medium hover:bg-emerald-700"
        >
          Bật chế độ học viên
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 flex flex-wrap items-center justify-between gap-2">
      <span>
        <strong>Chế độ học viên</strong> — giao diện &amp; khóa HSK giống học viên (không có nút admin)
      </span>
      <div className="flex flex-wrap gap-2">
        {showAdminExit && (
          <Link
            href="/admin"
            className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm hover:bg-sky-100"
          >
            Về quản trị
          </Link>
        )}
        <button
          type="button"
          onClick={() => toggle(false)}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-white text-sm font-medium hover:bg-sky-700"
        >
          Tắt — trở lại admin
        </button>
      </div>
    </div>
  );
}

/** Nút gọn trên header cho admin */
export function StudentPreviewNav() {
  const router = useRouter();
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(readPreviewFromCookie());
  }, []);

  if (on) {
    return (
      <button
        type="button"
        onClick={() => {
          writePreviewCookie(false);
          setOn(false);
          router.refresh();
        }}
        className="text-sky-700 hover:text-sky-900 font-medium"
      >
        Thoát chế độ HV
      </button>
    );
  }

  return (
    <Link href="/hoc?preview=1" className="text-emerald-700 hover:text-emerald-900 font-medium">
      Học thử
    </Link>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type AccessPayload = {
  allowed: boolean;
  reason?: string;
  isPremium: boolean;
  trialMinutes: number;
  remainingSeconds: number | null;
  zaloUrl: string;
  lockMessage: string;
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TrialBanner() {
  const [access, setAccess] = useState<AccessPayload | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/access")
        .then((r) => r.json())
        .then(setAccess)
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (!access || access.isPremium) return null;
  if (access.remainingSeconds == null) return null;

  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-900">
      Học thử còn lại:{" "}
      <strong>{formatTime(access.remainingSeconds)}</strong> / {access.trialMinutes} phút
    </div>
  );
}

export function LockScreen({ access }: { access: AccessPayload }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-stone-200 bg-white p-8 shadow-sm text-center">
      <div className="text-4xl mb-4">🔒</div>
      <h2 className="text-xl font-semibold text-stone-900 mb-3">Đã hết thời gian học thử</h2>
      <p className="text-stone-600 mb-6 leading-relaxed">{access.lockMessage}</p>
      <a
        href={access.zaloUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-white font-medium hover:bg-emerald-700 transition"
      >
        Liên hệ Zalo để mở khóa
      </a>
      <p className="mt-4 text-xs text-stone-500">
        Sau khi liên hệ, giáo viên sẽ cấp quyền học trong trang Admin → Học viên &amp; quyền truy cập.
      </p>
    </div>
  );
}

export function DeviceBlocked({ maxDevices = 2 }: { maxDevices?: number }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <h2 className="text-lg font-semibold text-red-900 mb-2">Vượt giới hạn thiết bị</h2>
      <p className="text-red-800 text-sm">
        Mỗi tài khoản Google chỉ dùng tối đa {maxDevices} thiết bị. Vui lòng liên hệ giáo viên để
        gỡ thiết bị cũ hoặc dùng máy đã đăng ký.
      </p>
      <Link href="/" className="mt-4 inline-block text-sm text-red-900 underline">
        Về trang chủ
      </Link>
    </div>
  );
}

export function useAccess() {
  const [access, setAccess] = useState<AccessPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/access")
      .then((r) => r.json())
      .then((data) => {
        setAccess(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { access, loading };
}

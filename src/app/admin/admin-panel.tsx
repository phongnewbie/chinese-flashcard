"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Settings = {
  trialMinutes: number;
  maxDevices: number;
  maxNewPerDay: number;
  learningSteps: string;
  zaloUrl: string;
  lockMessage: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  isPremium: boolean;
  canStudy: boolean;
  canEditContent: boolean;
  trialStartedAt: string | null;
  devices: { id: string; deviceKey: string; label: string | null; lastSeenAt: string }[];
};

type CourseRow = {
  id: string;
  title: string;
  published: boolean;
  _count: { cards: number };
};

export function AdminPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [msg, setMsg] = useState("");

  const reload = useCallback(() => {
    fetch("/api/admin/overview")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data.settings);
        setUsers(data.users);
        setCourses(data.courses);
      })
      .catch(() => setMsg("Không tải được dữ liệu admin"));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveSettings = async () => {
    if (!settings) return;
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) setMsg("Đã lưu cài đặt");
    else setMsg("Lỗi lưu cài đặt");
  };

  const createCourse = async () => {
    if (!newTitle.trim()) return;
    const res = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    if (res.ok) {
      setNewTitle("");
      reload();
      setMsg("Đã tạo khóa học");
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(
        res.status === 403
          ? "Không có quyền admin — kiểm tra ADMIN_EMAILS trên Render"
          : data.error ?? `Lỗi tạo khóa học (${res.status})`,
      );
    }
  };

  const patchUser = async (userId: string, body: Record<string, unknown>) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    reload();
  };

  const removeDevice = async (deviceId: string) => {
    await fetch(`/api/admin/devices/${deviceId}`, { method: "DELETE" });
    reload();
  };

  if (!settings) {
    return <p className="text-stone-500">Đang tải...</p>;
  }

  return (
    <div className="space-y-10">
      {msg && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {msg}
        </p>
      )}

      <section className="rounded-xl border border-stone-200 p-6 bg-white space-y-4">
        <h2 className="font-semibold text-lg">Cài đặt học thử &amp; Zalo</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Thời gian học thử (phút)
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2"
              value={settings.trialMinutes}
              onChange={(e) =>
                setSettings({ ...settings, trialMinutes: Number(e.target.value) })
              }
            />
          </label>
          <label className="text-sm">
            Số thiết bị tối đa / tài khoản
            <input
              type="number"
              min={1}
              max={10}
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2"
              value={settings.maxDevices}
              onChange={(e) =>
                setSettings({ ...settings, maxDevices: Number(e.target.value) })
              }
            />
          </label>
          <label className="text-sm">
            Thẻ mới / ngày (SRS)
            <input
              type="number"
              min={0}
              max={500}
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2"
              value={settings.maxNewPerDay}
              onChange={(e) =>
                setSettings({ ...settings, maxNewPerDay: Number(e.target.value) })
              }
            />
          </label>
          <label className="text-sm">
            Bước học (phút, cách nhau bởi dấu phẩy)
            <input
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2"
              value={settings.learningSteps}
              onChange={(e) =>
                setSettings({ ...settings, learningSteps: e.target.value })
              }
              placeholder="1,10"
            />
          </label>
        </div>
        <label className="text-sm block">
          Link Zalo
          <input
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2"
            value={settings.zaloUrl}
            onChange={(e) => setSettings({ ...settings, zaloUrl: e.target.value })}
          />
        </label>
        <label className="text-sm block">
          Thông báo khi hết học thử
          <textarea
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 min-h-[80px]"
            value={settings.lockMessage}
            onChange={(e) => setSettings({ ...settings, lockMessage: e.target.value })}
          />
        </label>
        <button
          type="button"
          onClick={saveSettings}
          className="rounded-lg bg-stone-900 text-white px-4 py-2 text-sm hover:bg-stone-800"
        >
          Lưu cài đặt
        </button>
      </section>

      <section className="rounded-xl border border-stone-200 p-6 bg-white space-y-4">
        <div>
          <h2 className="font-semibold text-lg">Khóa học</h2>
          <p className="text-xs text-stone-500 mt-0.5">Tạo khóa học để import bài học (Excel / Notepad .txt) cho học viên</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Tên khóa mới (VD: HSK 1, Tiếng Trung Sơ Cấp...)"
            className="flex-1 min-w-[240px] rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createCourse();
            }}
          />
          <button
            type="button"
            onClick={createCourse}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 transition"
          >
            + Thêm khóa học
          </button>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center bg-stone-50/50 space-y-2">
            <p className="text-sm font-medium text-stone-700">Chưa có khóa học nào trong hệ thống</p>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              Nhập tên khóa học vào ô trên (ví dụ: <strong className="text-stone-700">HSK 1</strong>) rồi bấm nút <strong className="text-emerald-700">+ Thêm khóa học</strong>. Sau đó bấm nút <strong className="text-emerald-700">Import Excel / Notepad</strong> để tải bài học lên.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {courses.map((c) => (
              <li key={c.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-stone-900">{c.title}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{c._count.cards} thẻ bài học</p>
                </div>
                <Link
                  href={`/admin/khoa/${c.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                >
                  📋 Browse &amp; quản lý thẻ (Anki) →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-stone-200 p-6 bg-white space-y-4 overflow-x-auto">
        <div>
          <h2 className="font-semibold text-lg">Học viên &amp; quyền truy cập</h2>
          <p className="text-xs text-stone-500 mt-1">
            Chỉ admin mới cấp được quyền học không giới hạn. Học viên chưa được cấp chỉ học thử trong thời gian giới hạn.
          </p>
        </div>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-stone-500 border-b">
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Cấp quyền học</th>
              <th className="py-2 pr-4">Sửa nội dung</th>
              <th className="py-2">Thiết bị</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-stone-50 align-top">
                <td className="py-3 pr-4">
                  <div>{u.email}</div>
                  <button
                    type="button"
                    className="text-xs text-stone-400 underline mt-1"
                    onClick={() => patchUser(u.id, { resetTrial: true })}
                  >
                    Reset học thử
                  </button>
                </td>
                <td className="py-3 pr-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={u.canStudy || u.isPremium}
                      onChange={(e) => patchUser(u.id, { canStudy: e.target.checked })}
                    />
                    <span className="text-xs text-stone-600">
                      {u.canStudy || u.isPremium ? "Được học" : "Chưa cấp"}
                    </span>
                  </label>
                </td>
                <td className="py-3 pr-4">
                  <input
                    type="checkbox"
                    checked={u.canEditContent}
                    onChange={(e) => patchUser(u.id, { canEditContent: e.target.checked })}
                  />
                </td>
                <td className="py-3">
                  <ul className="space-y-1">
                    {u.devices.map((d) => (
                      <li key={d.id} className="flex items-center gap-2 text-xs">
                        <span className="font-mono truncate max-w-[120px]">{d.deviceKey.slice(0, 8)}…</span>
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => removeDevice(d.id)}
                        >
                          Gỡ
                        </button>
                      </li>
                    ))}
                    {u.devices.length === 0 && <span className="text-stone-400">Chưa có</span>}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

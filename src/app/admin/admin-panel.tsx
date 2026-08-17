"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AdminAlert,
  AdminBtnPrimary,
  AdminCard,
  AdminEmpty,
  AdminField,
  AdminLoading,
  AdminSectionHeader,
  AdminToolbar,
  adminInputClass,
} from "./admin-ui";

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

export function AdminPanel({ section = "all" }: { section?: "all" | "settings" | "students" }) {
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
    return <AdminLoading />;
  }

  return (
    <div className="admin-tab-content">
      <AdminAlert>{msg}</AdminAlert>

      {(section === "all" || section === "settings") && (
        <AdminCard>
          <AdminSectionHeader
            title="Cài đặt học thử & Zalo"
            description="Thời gian dùng thử, link liên hệ và thông báo khi khóa bài học"
          />
          <div className="admin-form-grid">
            <AdminField label="Thời gian học thử (phút)">
              <input
                type="number"
                min={1}
                className={adminInputClass()}
                value={settings.trialMinutes}
                onChange={(e) =>
                  setSettings({ ...settings, trialMinutes: Number(e.target.value) })
                }
              />
            </AdminField>
            <AdminField label="Số thiết bị tối đa / tài khoản">
              <input
                type="number"
                min={1}
                max={10}
                className={adminInputClass()}
                value={settings.maxDevices}
                onChange={(e) =>
                  setSettings({ ...settings, maxDevices: Number(e.target.value) })
                }
              />
            </AdminField>
            <AdminField label="Thẻ mới / ngày (SRS)">
              <input
                type="number"
                min={0}
                max={500}
                className={adminInputClass()}
                value={settings.maxNewPerDay}
                onChange={(e) =>
                  setSettings({ ...settings, maxNewPerDay: Number(e.target.value) })
                }
              />
            </AdminField>
            <AdminField label="Bước học (phút, cách nhau bởi dấu phẩy)">
              <input
                className={adminInputClass()}
                value={settings.learningSteps}
                onChange={(e) =>
                  setSettings({ ...settings, learningSteps: e.target.value })
                }
                placeholder="1,10"
              />
            </AdminField>
            <AdminField label="Link Zalo" className="admin-field-full">
              <input
                className={adminInputClass()}
                value={settings.zaloUrl}
                onChange={(e) => setSettings({ ...settings, zaloUrl: e.target.value })}
              />
            </AdminField>
            <AdminField label="Thông báo khi hết học thử" className="admin-field-full">
              <textarea
                className={`${adminInputClass()} admin-textarea`}
                value={settings.lockMessage}
                onChange={(e) => setSettings({ ...settings, lockMessage: e.target.value })}
              />
            </AdminField>
          </div>
          <div className="admin-form-actions">
            <AdminBtnPrimary onClick={saveSettings}>Lưu cài đặt</AdminBtnPrimary>
          </div>
        </AdminCard>
      )}

      {section === "all" && (
        <AdminCard>
          <AdminSectionHeader
            title="Khóa học (legacy)"
            description="Tạo khóa học cũ — nên dùng tab Bộ thẻ / Bài học"
          />
          <AdminToolbar>
            <input
              placeholder="Tên khóa mới..."
              className={adminInputClass("admin-input-grow")}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createCourse();
              }}
            />
            <AdminBtnPrimary onClick={createCourse}>+ Thêm khóa học</AdminBtnPrimary>
          </AdminToolbar>
          {courses.length === 0 ? (
            <AdminEmpty>Chưa có khóa học legacy</AdminEmpty>
          ) : (
            <ul className="admin-list">
              {courses.map((c) => (
                <li key={c.id} className="admin-list-item">
                  <div>
                    <p className="admin-list-text font-medium">{c.title}</p>
                    <p className="text-xs text-stone-500">{c._count.cards} thẻ</p>
                  </div>
                  <Link href={`/admin/khoa/${c.id}`} className="admin-link-btn">
                    Browse →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      )}

      {(section === "all" || section === "students") && (
        <AdminCard>
          <AdminSectionHeader
            title="Học viên & quyền truy cập"
            description="Cấp quyền học không giới hạn hoặc reset thời gian học thử"
          />
          <div className="admin-table-wrap">
            <table className="admin-table">
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
            {users.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <AdminEmpty>Chưa có học viên đăng ký</AdminEmpty>
                </td>
              </tr>
            )}
          </tbody>
            </table>
          </div>
        </AdminCard>
      )}
    </div>
  );
}

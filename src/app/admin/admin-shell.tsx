"use client";

import Link from "next/link";
import { useState } from "react";
import { HskAccountsSection, HskCardsSection } from "./hsk-admin-board";
import { AdminPanel } from "./admin-panel";

const MAIN_TABS = [
  { id: "accounts", label: "Quản lý tài khoản" },
  { id: "cards", label: "Bộ thẻ / Bài học" },
  { id: "settings", label: "Cài đặt" },
  { id: "students", label: "Học viên" },
] as const;

type MainTabId = (typeof MAIN_TABS)[number]["id"];

export function AdminShell() {
  const [tab, setTab] = useState<MainTabId>("accounts");

  return (
    <div className="admin-shell">
      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-emerald-900">Học thử như học viên</p>
          <p className="text-sm text-emerald-800">Vào Bộ thẻ, bấm deck và học flashcard đúng giao diện học viên thấy.</p>
        </div>
        <Link
          href="/hoc?preview=1"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm font-medium hover:bg-emerald-700 shrink-0"
        >
          → Bật chế độ học viên
        </Link>
      </div>

      <nav className="admin-main-tabs" aria-label="Quản trị">
        {MAIN_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`admin-main-tab ${tab === t.id ? "admin-main-tab-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="admin-tab-panel">
        {tab === "accounts" && <HskAccountsSection />}
        {tab === "cards" && <HskCardsSection />}
        {tab === "settings" && <AdminPanel section="settings" />}
        {tab === "students" && <AdminPanel section="students" />}
      </div>
    </div>
  );
}

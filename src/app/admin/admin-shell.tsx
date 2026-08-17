"use client";

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

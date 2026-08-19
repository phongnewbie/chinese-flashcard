"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

export function AdminTabPanel({ children }: { children: ReactNode }) {
  return <div className="admin-tab-panel">{children}</div>;
}

export function AdminCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`admin-card ${className}`.trim()}>{children}</div>;
}

export function AdminSectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="admin-section-header">
      <h2 className="admin-section-title">{title}</h2>
      {description && <p className="admin-section-desc">{description}</p>}
    </div>
  );
}

export function AdminAlert({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="admin-alert">{children}</div>;
}

export function AdminLoading() {
  return <p className="admin-loading">Đang tải…</p>;
}

export function AdminField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`admin-field ${className}`.trim()}>
      <span className="admin-field-label">{label}</span>
      {children}
    </label>
  );
}

export function adminInputClass(extra = "") {
  return `admin-input ${extra}`.trim();
}

export function AdminBtnPrimary({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="admin-btn admin-btn-primary">
      {children}
    </button>
  );
}

export function AdminBtnSecondary({
  children,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} onClick={onClick} className="admin-btn admin-btn-secondary">
      {children}
    </button>
  );
}

export function AdminBtnDanger({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="admin-btn admin-btn-danger">
      {children}
    </button>
  );
}

export function AdminToolbar({ children }: { children: ReactNode }) {
  return <div className="admin-toolbar">{children}</div>;
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <div className="admin-empty">{children}</div>;
}

/** Nút Import/Upload — ẩn "Choose file / No file chosen" mặc định của trình duyệt. */
export function ImportFileButton({
  label,
  accept,
  onFile,
  disabled,
  variant = "primary",
}: {
  label: string;
  accept?: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const btnClass =
    variant === "primary" ? "admin-btn admin-btn-primary" : "admin-btn admin-btn-secondary";

  return (
    <div className="admin-import-file">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="admin-file-input-hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      <button
        type="button"
        className={btnClass}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </button>
    </div>
  );
}

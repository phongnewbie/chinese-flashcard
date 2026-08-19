"use client";

import { useEffect, useState } from "react";
import type { PersistenceInfo } from "@/lib/persistence";

export function PersistenceBanner() {
  const [info, setInfo] = useState<PersistenceInfo | null>(null);

  useEffect(() => {
    fetch("/api/admin/persistence", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => {});
  }, []);

  if (!info?.warning) return null;

  return (
    <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 mb-4">
      <p className="font-semibold">⚠️ Dữ liệu có thể bị mất khi redeploy</p>
      <p className="mt-1 leading-relaxed">{info.warning}</p>
      <p className="mt-2 text-xs text-red-800 font-mono break-all">
        DB: {info.dbPath} ({Math.round(info.dbSizeBytes / 1024)} KB)
      </p>
    </div>
  );
}

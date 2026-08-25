"use client";

import { Suspense, useEffect, useState } from "react";
import { StudentPreviewBar } from "@/components/student-preview-bar";

function AdminOnlyPreviewBar() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/access")
      .then((r) => r.json())
      .then((d: { isAdmin?: boolean }) => setIsAdmin(!!d.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  if (!isAdmin) return null;
  return <StudentPreviewBar />;
}

export function StudentPreviewSection() {
  return (
    <Suspense fallback={null}>
      <div className="px-4 pt-4 max-w-5xl mx-auto">
        <AdminOnlyPreviewBar />
      </div>
    </Suspense>
  );
}

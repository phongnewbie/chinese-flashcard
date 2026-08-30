"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function AdminNavLinks() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/access")
      .then((r) => r.json())
      .then((d: { isAdmin?: boolean }) => setIsAdmin(!!d.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  if (!isAdmin) return null;

  return (
    <Link href="/admin" className="text-emerald-700 hover:text-emerald-900 font-medium">
      Quản trị
    </Link>
  );
}

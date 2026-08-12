"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "cn_flashcard_device_id";

export function getOrCreateDeviceKey(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function useDeviceRegistration(enabled: boolean) {
  const [status, setStatus] = useState<"idle" | "ok" | "blocked">("idle");

  useEffect(() => {
    if (!enabled) return;
    const key = getOrCreateDeviceKey();
    fetch("/api/device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceKey: key }),
    })
      .then(async (res) => {
        if (res.status === 403) setStatus("blocked");
        else if (res.ok) setStatus("ok");
      })
      .catch(() => setStatus("idle"));
  }, [enabled]);

  return status;
}

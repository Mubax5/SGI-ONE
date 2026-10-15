"use client";
import { useEffect, useState } from "react";
export function workspaceHeaders(): Record<string, string> {
  const role =
    typeof document === "undefined"
      ? null
      : document
          .querySelector("[data-active-workspace]")
          ?.getAttribute("data-active-workspace");
  return role ? { "x-sgi-workspace": role } : {};
}
export function announceChange() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("sgi-data-changed"));
}
/** One cursor per mounted shell; record views subscribe without discarding edits. */
export function useChangeMonitor() {
  useEffect(() => {
    let active = true,
      busy = false,
      version: string | undefined;
    const check = async () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const response = await fetch("/api/changes", {
          headers: workspaceHeaders(),
          cache: "no-store",
        });
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (response.status === 403) {
          const identity = await fetch("/api/me", { cache: "no-store" });
          if (identity.ok) {
            const account = await identity.json();
            const selected = workspaceHeaders()["x-sgi-workspace"];
            if (selected && !account.actor.roles.includes(selected)) {
              window.location.assign("/home");
              return;
            }
          }
        }
        if (!response.ok) throw new Error("Sinkronisasi belum tersedia.");
        const next = (await response.json()).version as string;
        if (active && version !== undefined && version !== next)
          announceChange();
        version = next;
      } catch {
        /* Polling resumes when the connection returns. */
      } finally {
        busy = false;
      }
    };
    const tick = () => void check().catch(() => {});
    tick();
    const interval = window.setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);
}
export function useLiveRevision() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const update = () => setRevision((value) => value + 1);
    window.addEventListener("sgi-data-changed", update);
    return () => window.removeEventListener("sgi-data-changed", update);
  }, []);
  return revision;
}

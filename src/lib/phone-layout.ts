"use client";
import { useSyncExternalStore } from "react";

// A range query also handles fractional CSS widths from browser zoom/display scaling.
const query = "(width < 640px)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export function usePhoneLayout() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

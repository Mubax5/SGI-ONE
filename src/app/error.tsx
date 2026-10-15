"use client";
import { AppErrorState } from "@/components/app-error-state";
export default function ErrorPage() {
  return (
    <AppErrorState
      kind="error"
      fullPage
      onRetry={() => window.location.reload()}
    />
  );
}

"use client";
import { AppErrorState } from "@/components/app-error-state";
export default function ErrorPage() {
  return (
    <AppErrorState kind="error" onRetry={() => window.location.reload()} />
  );
}

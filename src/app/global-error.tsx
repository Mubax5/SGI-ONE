"use client";
import "./globals.css";
import "./workspace.css";
import "@fontsource-variable/inter";
import { AppErrorState } from "@/components/app-error-state";
export default function GlobalError() {
  return (
    <html lang="id" data-mode="light" data-theme="sgi">
      <body>
        <AppErrorState
          kind="error"
          fullPage
          onRetry={() => window.location.reload()}
        />
      </body>
    </html>
  );
}

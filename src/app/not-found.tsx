import { AppErrorState } from "@/components/app-error-state";
export default function NotFound() {
  return <AppErrorState kind="not-found" fullPage />;
}

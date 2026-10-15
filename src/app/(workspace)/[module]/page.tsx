import { notFound } from "next/navigation";
import { Workbench } from "@/components/workbench";
import { getActor } from "@/lib/security";
import { can, Permission } from "@/lib/domain";
import type { ModuleKey } from "@/components/types";
import { RoleDashboard } from "@/components/role-dashboard";
import { ReportsPage } from "@/components/reports";
import { analyticsRoles } from "@/lib/workspace";
import {
  activeWorkspace,
  redirectLegacyWorkspace,
} from "@/lib/workspace-server";
import { AppErrorState } from "@/components/app-error-state";
import { SystemPage } from "@/components/system-overview";
import { Homepage } from "@/components/homepage";
import { JobMap } from "@/components/job-map";
import { AttendancePage } from "@/components/attendance-page";
const modules: Record<string, Permission | null> = {
  dashboard: "dashboard",
  home: "dashboard",
  analytics: "dashboard",
  maps: "jobsRead",
  customers: "customersRead",
  requests: "quotationsRead",
  quotations: "quotationsRead",
  jobs: "jobsRead",
  documents: "documentsRead",
  reports: "reportsRead",
  billing: "billingRead",
  invoices: "invoicesRead",
  payments: "paymentsRead",
  attendance: "attendanceSelf",
  users: "users",
  audit: "audit",
  system: "users",
};
export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { module } = await params;
  if (!Object.hasOwn(modules, module)) notFound();
  const identity = await getActor();
  const query = await searchParams;
  redirectLegacyWorkspace(`/${module}`, query);
  const value = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : "";
  const permission = modules[module];
  const role = await activeWorkspace(identity);
  const actor = { ...identity, roles: [role] };
  if (permission && !can(actor, permission))
    return <AppErrorState kind="forbidden" />;
  if (module === "home" || module === "dashboard")
    return <Homepage key={role} actor={identity} role={role} />;
  if (module === "maps") return <JobMap key={role} actor={actor} />;
  if (module === "attendance")
    return <AttendancePage key={role} actor={actor} />;
  if (module === "system") return <SystemPage />;
  if (module === "analytics")
    return analyticsRoles.includes(role) ? (
      <RoleDashboard key={role} actor={identity} role={role} />
    ) : (
      <AppErrorState kind="forbidden" />
    );
  if (module === "reports")
    return (
      <ReportsPage
        key={JSON.stringify([role, query])}
        actor={actor}
        createOnLoad={value("create") === "1"}
        initialSearch={value("q")}
        initialJob={value("job")}
      />
    );
  return (
    <Workbench
      key={JSON.stringify([role, query])}
      module={module as ModuleKey}
      actor={actor}
      createOnLoad={value("create") === "1"}
      initialSearch={value("q")}
      initialRecord={value("record")}
      initialStatus={value("status") || "all"}
    />
  );
}

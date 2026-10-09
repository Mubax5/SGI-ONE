import { notFound } from "next/navigation";
import { Workbench } from "@/components/workbench";
import { getActor } from "@/lib/security";
import { can, Permission } from "@/lib/domain";
import type { ModuleKey } from "@/components/types";
import { RoleDashboard } from "@/components/role-dashboard";
import { ReportsPage } from "@/components/reports";
import { workspaceRole } from "@/lib/workspace";
import { Homepage } from "@/components/homepage";
import { JobMap } from "@/components/job-map";
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
  attendance: null,
  users: "users",
  audit: "audit",
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
  const actor = await getActor();
  const query = await searchParams;
  const value = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : "";
  const permission = modules[module];
  if (permission && !can(actor, permission))
    return (
      <div className="empty">
        <h1>Akses terbatas</h1>
        <p>
          Role Anda tidak memiliki izin untuk halaman ini. Gunakan navigasi yang
          tersedia atau hubungi administrator.
        </p>
      </div>
    );
  if (module === "home" || module === "dashboard")
    return (
      <Homepage
        key={value("role") || "default"}
        actor={actor}
        role={workspaceRole(actor, value("role"))}
      />
    );
  if (module === "maps") return <JobMap actor={actor} />;
  if (module === "analytics")
    return (
      <RoleDashboard
        key={value("role") || "default"}
        actor={actor}
        role={workspaceRole(actor, value("role"))}
      />
    );
  if (module === "reports")
    return (
      <ReportsPage
        key={JSON.stringify(query)}
        actor={actor}
        createOnLoad={value("create") === "1"}
        initialSearch={value("q")}
        initialJob={value("job")}
      />
    );
  return (
    <Workbench
      key={JSON.stringify(query)}
      module={module as ModuleKey}
      actor={actor}
      createOnLoad={value("create") === "1"}
      initialSearch={value("q")}
      initialRecord={value("record")}
      initialStatus={value("status") || "all"}
    />
  );
}

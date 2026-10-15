"use client";
import { LinkButton, Tabs, Text } from "@cloudflare/kumo";
import { HouseIcon } from "@phosphor-icons/react";
import { usePhoneLayout } from "@/lib/phone-layout";
import { WorkspaceLink } from "./workspace-link";
import type { Actor, Role } from "@/lib/domain";
import { workspaceNavigation } from "./navigation";
import { RoleDashboard } from "./role-dashboard";
const quickRoutes: Record<Role, string[]> = {
  operations: ["/jobs", "/reports", "/documents", "/maps"],
  field: ["/jobs", "/reports", "/documents", "/attendance"],
  finance: ["/billing", "/invoices", "/payments", "/analytics"],
  director: ["/analytics", "/jobs", "/invoices", "/maps"],
  sales: ["/customers", "/requests", "/quotations", "/analytics"],
  admin: ["/system", "/users", "/audit"],
};
const quickLabels: Record<string, string> = {
  "/system": "Sistem",
  "/users": "Pengguna",
  "/audit": "Audit",
  "/attendance": "Absensi",
  "/jobs": "Job order",
  "/reports": "Laporan",
  "/documents": "Dokumen",
  "/maps": "Peta",
  "/billing": "Tagihan",
  "/invoices": "Invoice",
  "/payments": "Pembayaran",
  "/analytics": "Analitik",
  "/customers": "Customer",
  "/requests": "Order",
  "/quotations": "Penawaran",
};
export function Homepage({ actor, role }: { actor: Actor; role: Role }) {
  const menus = workspaceNavigation(actor, role);
  const phone = usePhoneLayout();
  const shortcuts = quickRoutes[role]
    .map((path) => menus.find((item) => item.href === path))
    .filter((item) => !!item);
  return (
    <RoleDashboard
      actor={actor}
      role={role}
      presentation="dashboard"
      homepageTools={() => (
        <section
          className="homepage-access"
          aria-labelledby="home-access-title"
        >
          <Text as="h2" variant="heading" id="home-access-title">
            Akses cepat
          </Text>
          {phone ? (
            <nav className="quick-access-grid" aria-label="Akses cepat">
              {quickRoutes[role]
                .map((path) => menus.find((item) => item.href === path))
                .filter((item) => !!item)
                .map((item) => (
                  <LinkButton
                    key={item.href}
                    href={item.href}
                    variant="outline"
                    icon={<item.icon size={20} />}
                  >
                    <span className="quick-access-label">
                      {role === "field" && item.href === "/jobs"
                        ? "Tugas saya"
                        : quickLabels[item.href]}
                    </span>
                  </LinkButton>
                ))}
            </nav>
          ) : (
            <nav aria-label="Akses cepat" className="desktop-quick-access">
              <Tabs
                className="quick-access-tabs"
                variant="segmented"
                value="/home"
                tabs={[
                  {
                    value: "/home",
                    label: (
                      <span className="nav-tab-label">
                        <HouseIcon size={16} />
                        Dashboard
                      </span>
                    ),
                    render: <WorkspaceLink href="/home" aria-current="page" />,
                    nativeButton: false,
                  },
                  ...shortcuts.map((item) => ({
                    value: item.href,
                    label: (
                      <span className="nav-tab-label">
                        <item.icon size={16} />
                        {role === "field" && item.href === "/jobs"
                          ? "Tugas saya"
                          : quickLabels[item.href]}
                      </span>
                    ),
                    render: <WorkspaceLink href={item.href} />,
                    nativeButton: false as const,
                  })),
                ]}
                labels={{
                  scrollStart: "Tab sebelumnya",
                  scrollEnd: "Tab berikutnya",
                }}
              />
            </nav>
          )}
        </section>
      )}
    />
  );
}

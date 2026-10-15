import { Actor, DomainError, Role } from "./domain";

const order: Role[] = [
  "admin",
  "director",
  "operations",
  "finance",
  "sales",
  "field",
];
export function workspaceRole(actor: Actor, requested?: string | null): Role {
  if (requested) {
    if (!actor.roles.includes(requested as Role))
      throw new DomainError(
        "Anda tidak memiliki akses ke area kerja ini. Pilih area lain.",
        403,
      );
    return requested as Role;
  }
  const role = order.find((item) => actor.roles.includes(item));
  if (!role)
    throw new DomainError(
      "Akun belum memiliki peran. Hubungi administrator.",
      403,
    );
  return role;
}
export const workspaceActions: Record<Role, { label: string; href: string }> = {
  director: { label: "Laporan", href: "/analytics#penagihan" },
  operations: { label: "Laporan", href: "/reports?create=1" },
  field: { label: "Laporan", href: "/reports?create=1" },
  finance: { label: "Invoice", href: "/invoices?create=1" },
  sales: { label: "Order", href: "/requests?create=1" },
  admin: { label: "Sistem", href: "/system" },
};
export const analyticsRoles: Role[] = [
  "operations",
  "finance",
  "director",
  "sales",
];
export const workspaceDescriptions: Record<Role, string> = {
  admin: "Akun dan akses",
  operations: "Job dan penugasan",
  field: "Tugas dan laporan",
  finance: "Tagihan dan pembayaran",
  director: "Kinerja dan piutang",
  sales: "Customer dan penawaran",
};

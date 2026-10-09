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
      throw new DomainError("Workspace ini tidak termasuk role Anda.", 403);
    return requested as Role;
  }
  const role = order.find((item) => actor.roles.includes(item));
  if (!role)
    throw new DomainError(
      "Akun belum memiliki role. Hubungi administrator.",
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
  admin: { label: "Pengguna", href: "/users?create=1" },
};

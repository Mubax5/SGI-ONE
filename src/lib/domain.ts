export const roleKeys = [
  "director",
  "operations",
  "field",
  "finance",
  "sales",
  "admin",
] as const;
export type Role = (typeof roleKeys)[number];
export const roleLabels: Record<Role, string> = {
  director: "Direktur",
  operations: "Operations",
  field: "Petugas lapangan",
  finance: "Finance",
  sales: "Sales",
  admin: "System admin",
};
export const permissions = {
  customersRead: ["director", "operations", "finance", "sales"],
  customersWrite: ["operations", "sales"],
  jobsRead: ["director", "operations", "finance", "field"],
  jobsWrite: ["operations"],
  jobsProgress: ["operations", "field"],
  documentsRead: ["director", "operations", "finance", "field"],
  documentsUpload: ["operations", "field"],
  documentsReview: ["operations"],
  billingRead: ["director", "finance", "operations"],
  invoicesRead: ["director", "finance"],
  paymentsRead: ["director", "finance"],
  billablesWrite: ["finance", "operations"],
  invoicesWrite: ["finance"],
  paymentsWrite: ["finance"],
  dashboard: ["director", "operations", "field", "finance", "sales", "admin"],
  reportsRead: ["director", "operations", "field"],
  audit: ["director", "admin"],
  users: ["admin"],
  quotationsRead: ["director", "operations", "finance", "sales"],
  quotationsWrite: ["sales", "finance"],
  quotationsApprove: ["finance"],
  requestsWrite: ["sales", "operations"],
} satisfies Record<string, Role[]>;
export type Permission = keyof typeof permissions;
export type Actor = { id: string; name: string; email: string; roles: Role[] };
export const can = (actor: Actor, permission: Permission) =>
  permissions[permission].some((r) => actor.roles.includes(r));
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function requirePermission(actor: Actor, permission: Permission) {
  if (!can(actor, permission))
    throw new DomainError("Anda tidak memiliki izin untuk tindakan ini.", 403);
}
export const statuses: Record<string, string> = {
  active: "Aktif",
  inactive: "Nonaktif",
  draft: "Draft",
  assigned: "Ditugaskan",
  in_progress: "Dalam proses",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  submitted: "Menunggu review",
  verified: "Terverifikasi",
  rejected: "Ditolak",
  issued: "Terbit",
  void: "Void",
  paid: "Lunas",
  partially_paid: "Dibayar sebagian",
  overdue: "Lewat jatuh tempo",
  unpaid: "Belum dibayar",
  approved: "Disetujui",
};
export const services = {
  trucking: "Trucking",
  forwarding: "Freight forwarding",
  warehousing: "Pergudangan",
} as const;
export const documentTypes = {
  delivery_note: "Surat jalan bertanda tangan",
  proof_of_delivery: "Bukti serah terima",
  cargo_manifest: "Manifest muatan",
  warehouse_receipt: "Bukti penerimaan gudang",
  other: "Dokumen pendukung",
} as const;
export const checklists: Record<string, string[]> = {
  trucking: ["delivery_note", "proof_of_delivery"],
  forwarding: ["delivery_note", "cargo_manifest"],
  warehousing: ["warehouse_receipt", "proof_of_delivery"],
};
export const transitions: Record<string, string[]> = {
  draft: ["assigned", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};
export function validateTransition(
  from: string,
  to: string,
  assignmentCount: number,
) {
  if (!transitions[from]?.includes(to))
    throw new DomainError("Perubahan status tidak sesuai urutan pekerjaan.");
  if (to === "assigned" && !assignmentCount)
    throw new DomainError("Tugaskan minimal satu petugas sebelum melanjutkan.");
}
export const MAX_MONEY = 9_000_000_000_000;
export function moneyFromInput(input: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(input))
    throw new DomainError(
      "Masukkan nominal positif, maksimal dua angka desimal (contoh 2500000).",
    );
  const [whole, fraction = ""] = input.split(".");
  const value = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (value <= 0n || value > BigInt(MAX_MONEY))
    throw new DomainError("Nominal di luar batas yang diizinkan.");
  return Number(value);
}
export const formatMoney = (amount: number, currency = "IDR") =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "IDR" ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);
export function totals(amounts: number[], taxBps: number) {
  const sub = amounts.reduce((sum, a) => sum + BigInt(a), 0n);
  const tax = (sub * BigInt(taxBps) + 5000n) / 10000n;
  if (sub + tax > BigInt(MAX_MONEY))
    throw new DomainError("Total invoice melampaui batas nominal.");
  return { subtotal: Number(sub), tax: Number(tax), total: Number(sub + tax) };
}
export function invoiceBalance(
  total: number,
  allocated: number,
  corrected: number,
) {
  return Math.max(0, total - allocated - corrected);
}
export function paymentStatus(
  status: string,
  outstanding: number,
  paid: number,
  dueAt: Date | string | null,
) {
  if (status !== "issued") return status;
  if (outstanding === 0) return "paid";
  if (dueAt && new Date(dueAt) < new Date()) return "overdue";
  return paid > 0 ? "partially_paid" : "unpaid";
}

"use client";
import {
  ChartPieIcon,
  BuildingsIcon,
  PackageIcon,
  NotePencilIcon,
  TruckIcon,
  FilesIcon,
  CoinsIcon,
  ReceiptIcon,
  WalletIcon,
  ClockIcon,
  UsersIcon,
  ShieldCheckIcon,
  StackIcon,
  BankIcon,
  GearSixIcon,
  CameraIcon,
  HouseIcon,
  MapTrifoldIcon,
  ChartBarIcon,
} from "@phosphor-icons/react";
import { can, type Actor, type Permission, type Role } from "@/lib/domain";
import { analyticsRoles } from "@/lib/workspace";
export const navigation: {
  href: string;
  label: string;
  shortLabel: string;
  icon: typeof TruckIcon;
  permission?: Permission;
  group: string;
  roles?: Role[];
}[] = [
  {
    href: "/home",
    label: "Dashboard",
    shortLabel: "Beranda",
    icon: HouseIcon,
    permission: "dashboard",
    group: "Pemantauan",
  },
  {
    href: "/analytics",
    roles: analyticsRoles,
    label: "Analitik",
    shortLabel: "Analitik",
    icon: ChartPieIcon,
    permission: "dashboard",
    group: "Pemantauan",
  },
  {
    href: "/maps",
    label: "Peta pekerjaan",
    shortLabel: "Peta",
    icon: MapTrifoldIcon,
    permission: "jobsRead",
    group: "Operasional",
  },
  {
    href: "/customers",
    label: "Customer",
    shortLabel: "Klien",
    icon: BuildingsIcon,
    permission: "customersRead",
    group: "Operasional",
  },
  {
    href: "/requests",
    label: "Permintaan order",
    shortLabel: "Order",
    icon: PackageIcon,
    permission: "quotationsRead",
    group: "Operasional",
  },
  {
    href: "/quotations",
    label: "Penawaran & kontrak",
    shortLabel: "Tarif",
    icon: NotePencilIcon,
    permission: "quotationsRead",
    group: "Operasional",
  },
  {
    href: "/jobs",
    label: "Job order",
    shortLabel: "Job",
    icon: TruckIcon,
    permission: "jobsRead",
    group: "Operasional",
  },
  {
    href: "/reports",
    label: "Laporan pekerjaan",
    shortLabel: "Lapor",
    icon: CameraIcon,
    permission: "reportsRead",
    group: "Operasional",
  },
  {
    href: "/documents",
    label: "Dokumen & review",
    shortLabel: "Berkas",
    icon: FilesIcon,
    permission: "documentsRead",
    group: "Operasional",
  },
  {
    href: "/billing",
    label: "Komponen tagihan",
    shortLabel: "Tagihan",
    icon: CoinsIcon,
    permission: "billingRead",
    group: "Keuangan",
  },
  {
    href: "/invoices",
    label: "Invoice",
    shortLabel: "Invoice",
    icon: ReceiptIcon,
    permission: "invoicesRead",
    group: "Keuangan",
  },
  {
    href: "/payments",
    label: "Pembayaran",
    shortLabel: "Bayar",
    icon: WalletIcon,
    permission: "paymentsRead",
    group: "Keuangan",
  },
  {
    href: "/attendance",
    permission: "attendanceSelf",
    label: "Absensi saya",
    shortLabel: "Absen",
    icon: ClockIcon,
    group: "Administrasi",
  },
  {
    href: "/users",
    label: "Pengguna & akses",
    shortLabel: "Akun",
    icon: UsersIcon,
    permission: "users",
    group: "Administrasi",
  },
  {
    href: "/audit",
    label: "Audit trail",
    shortLabel: "Audit",
    icon: ShieldCheckIcon,
    permission: "audit",
    group: "Administrasi",
  },
];
navigation.push({
  href: "/system",
  label: "Administrasi sistem",
  shortLabel: "Sistem",
  icon: GearSixIcon,
  permission: "users",
  roles: ["admin"],
  group: "Administrasi",
});
export function workspaceNavigation(actor: Actor, role: Role) {
  const scoped = { ...actor, roles: [role] };
  return navigation.filter(
    (item) =>
      (!item.roles || item.roles.includes(role)) &&
      (!item.permission || can(scoped, item.permission)),
  );
}
export const navigationGroups = [
  { label: "Pemantauan", icon: ChartBarIcon },
  { label: "Operasional", icon: StackIcon },
  { label: "Keuangan", icon: BankIcon },
  { label: "Administrasi", icon: GearSixIcon },
];

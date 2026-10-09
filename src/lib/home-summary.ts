import type { WorkspaceData } from "@/modules/workspace";
import type { Serialized } from "@/components/types";
import { formatMoney } from "./domain";
export type HomeStat = { label: string; value: string; href: string };
export function homeSummary(data: Serialized<WorkspaceData>): {
  title: string;
  subtitle: string;
  summary: HomeStat[];
  statuses: HomeStat[];
  notice: string;
  action: string;
  href: string;
} {
  const stat = (
    label: string,
    value: number | string,
    href: string,
  ): HomeStat => ({ label, value: String(value), href });
  switch (data.role) {
    case "operations": {
      const active = data.jobs.filter(
        (j) => !["completed", "cancelled"].includes(j.status),
      );
      const unassigned = active.filter((j) => j.assignees.length === 0).length;
      return {
        title: "Kendali operasional",
        subtitle: "Penugasan & kesiapan dokumen",
        summary: [
          stat("Job aktif", active.length, "/jobs"),
          stat(
            "Perlu review",
            data.reviews.length,
            "/documents?status=submitted",
          ),
        ],
        statuses: [
          stat("Semua job", data.jobs.length, "/jobs"),
          stat(
            "Berjalan",
            data.jobs.filter((j) => j.status === "in_progress").length,
            "/jobs?status=in_progress",
          ),
          stat(
            "Selesai",
            data.jobs.filter((j) => j.status === "completed").length,
            "/jobs?status=completed",
          ),
          stat(
            "Tugas baru",
            data.jobs.filter((j) => j.status === "assigned").length,
            "/jobs?status=assigned",
          ),
        ],
        notice: unassigned
          ? `${unassigned} job aktif belum memiliki petugas.`
          : `${data.reviews.length} dokumen menunggu pemeriksaan Operations.`,
        action: unassigned ? "Atur penugasan" : "Periksa dokumen",
        href: unassigned ? "/jobs" : "/documents?status=submitted",
      };
    }
    case "field": {
      const active = data.jobs.filter(
        (j) => !["completed", "cancelled"].includes(j.status),
      );
      const due = active.filter(
        (j) => new Date(j.dueAt).getTime() < Date.now(),
      ).length;
      return {
        title: "Pekerjaan saya",
        subtitle: "Penugasan, bukti & laporan lapangan",
        summary: [
          stat("Tugas aktif", active.length, "/jobs"),
          stat("Laporan saya", data.reports.length, "/reports"),
        ],
        statuses: [
          stat("Semua tugas", data.jobs.length, "/jobs"),
          stat(
            "Berjalan",
            data.jobs.filter((j) => j.status === "in_progress").length,
            "/jobs?status=in_progress",
          ),
          stat(
            "Selesai",
            data.jobs.filter((j) => j.status === "completed").length,
            "/jobs?status=completed",
          ),
          stat(
            "Tugas baru",
            data.jobs.filter((j) => j.status === "assigned").length,
            "/jobs?status=assigned",
          ),
        ],
        notice: due
          ? `${due} tugas melewati tenggat. Perbarui progres dan bukti kerja.`
          : `${active.length} tugas aktif. Catat progres dan foto setelah bekerja.`,
        action: "Buat laporan",
        href: "/reports?create=1",
      };
    }
    case "finance": {
      const issued = data.invoices.filter((i) => i.status === "issued");
      const due = issued.filter((i) => i.outstanding > 0);
      const drafts = data.invoices.filter((i) => i.status === "draft");
      return {
        title: "Penagihan & penerimaan",
        subtitle: "Invoice, pembayaran & piutang",
        summary: [
          stat("Draft invoice", drafts.length, "/invoices?status=draft"),
          stat("Invoice bersaldo", due.length, "/invoices?status=outstanding"),
        ],
        statuses: [
          stat("Invoice", data.invoices.length, "/invoices"),
          stat("Draft", drafts.length, "/invoices?status=draft"),
          stat("Terbit", issued.length, "/invoices?status=issued"),
          stat("Bayar", data.payments.length, "/payments"),
        ],
        notice: `${drafts.length} draft perlu diperiksa sebelum diterbitkan. ${due.length} invoice masih memiliki saldo piutang.`,
        action: "Siapkan invoice",
        href: "/invoices?create=1",
      };
    }
    case "director": {
      const idr = data.currencies.find((c) => c.currency === "IDR");
      return {
        title: "Kinerja bisnis",
        subtitle: "Operasional, penagihan & arus penerimaan",
        summary: [
          stat("Job aktif", data.activeJobs, "/jobs"),
          stat(
            "Piutang IDR",
            formatMoney(idr?.outstanding ?? 0, "IDR"),
            "/analytics#penagihan",
          ),
        ],
        statuses: [
          stat("Job aktif", data.activeJobs, "/jobs"),
          stat("Review", data.pendingDocuments, "/documents?status=submitted"),
          stat("Draft", data.draftCount, "/invoices?status=draft"),
          stat("Siap tagih", data.readyBillables, "/billing"),
        ],
        notice: `${data.pendingDocuments} dokumen menunggu review; ${data.readyBillables} komponen siap ditagihkan.`,
        action: "Lihat analitik",
        href: "/analytics",
      };
    }
    case "sales": {
      const drafts = data.quotations.filter((q) => q.status === "draft").length;
      return {
        title: "Relasi & pipeline",
        subtitle: "Customer, permintaan & penawaran",
        summary: [
          stat("Customer", data.customers.length, "/customers"),
          stat("Permintaan", data.requests.length, "/requests"),
        ],
        statuses: [
          stat("Customer", data.customers.length, "/customers"),
          stat("Order", data.requests.length, "/requests"),
          stat("Penawaran", data.quotations.length, "/quotations"),
          stat(
            "Disetujui",
            data.quotations.filter((q) => q.status === "approved").length,
            "/quotations?status=approved",
          ),
        ],
        notice: `${drafts} draft penawaran belum disetujui. Tindak lanjuti sebelum pekerjaan dimulai.`,
        action: "Lihat penawaran",
        href: "/quotations?status=draft",
      };
    }
    case "admin": {
      const noRole = data.users.filter(
        (u) => u.active && !u.roles.length,
      ).length;
      return {
        title: "Pengguna & akses",
        subtitle: "Akun internal, role & audit",
        summary: [
          stat(
            "Akun aktif",
            data.users.filter((u) => u.active).length,
            "/users?status=active",
          ),
          stat("Tanpa role", noRole, "/users?status=unassigned"),
        ],
        statuses: [
          stat("Pengguna", data.users.length, "/users"),
          stat(
            "Aktif",
            data.users.filter((u) => u.active).length,
            "/users?status=active",
          ),
          stat(
            "Nonaktif",
            data.users.filter((u) => !u.active).length,
            "/users?status=inactive",
          ),
          stat("Audit terbaru", data.audit.length, "/audit?q=user"),
        ],
        notice: noRole
          ? `${noRole} akun aktif belum memiliki role. Periksa akses pengguna.`
          : "Periksa akun internal dan jejak perubahan sebelum mengubah akses.",
        action: "Kelola pengguna",
        href: "/users",
      };
    }
  }
}

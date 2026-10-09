"use client";
import Link from "next/link";
import { Button, Input, LayerCard, Select } from "@cloudflare/kumo";
import {
  PlusIcon,
  ArrowRightIcon,
  DownloadSimpleIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { Actor, can, formatMoney, roleLabels, checklists } from "@/lib/domain";
import {
  api,
  DataTable,
  dateText,
  Feedback,
  filterRows,
  Modal,
  Refresh,
  Status,
} from "./shared";
import { Editor, EditorMode } from "./editor";
import { DashboardView } from "./dashboard";
import { ReportPeriod } from "./report-period";
import { defaultReportPeriod } from "@/lib/report-period";
import { InvoiceView } from "./invoice-detail";
import { AuditView, PaymentView } from "./transaction-details";
import { PageHeader, CollectionPanel, LoadingState } from "./workspace-ui";
import type {
  Attendance,
  AuditRow,
  Billable,
  Customer,
  Dashboard,
  Document,
  FormDataSources,
  Invoice,
  Job,
  ModuleKey,
  OrderRequest,
  Payment,
  Quotation,
  UserRow,
} from "./types";
const meta: Record<
  ModuleKey,
  {
    title: string;
    description: string;
    action?: string;
    mode?: EditorMode;
    endpoint?: string;
  }
> = {
  dashboard: {
    title: "Dashboard",
    description: "Posisi operasional dan piutang, langsung dari transaksi.",
  },
  customers: {
    title: "Customer",
    description: "Kontak, alamat penagihan, dan relasi pelanggan SGI.",
    action: "Tambah customer",
    mode: "customer",
    endpoint: "customers",
  },
  requests: {
    title: "Permintaan order",
    description: "Kebutuhan pelanggan yang akan diteruskan menjadi pekerjaan.",
    action: "Catat permintaan",
    mode: "request",
    endpoint: "requests",
  },
  quotations: {
    title: "Penawaran & kontrak",
    description:
      "Dasar tarif dan persetujuan termin. Setiap revisi tetap dapat ditelusuri.",
    action: "Buat penawaran",
    mode: "quotation",
    endpoint: "quotations",
  },
  jobs: {
    title: "Job order",
    description:
      "Pantau PIC, progres pekerjaan, tenggat, dan kesiapan dokumen.",
    action: "Buat job order",
    mode: "job",
    endpoint: "jobs",
  },
  documents: {
    title: "Dokumen & review",
    description:
      "Bukti lapangan privat, versi dokumen, dan keputusan Operations.",
  },
  billing: {
    title: "Komponen tagihan",
    description:
      "Tarif disetujui, saldo tersedia, serta syarat penerbitan per pekerjaan.",
    action: "Tambah komponen",
    mode: "billable",
    endpoint: "billables",
  },
  invoices: {
    title: "Invoice",
    description:
      "Draft fleksibel dari beberapa job, dengan validasi saat penerbitan.",
    action: "Buat draft invoice",
    mode: "draft",
    endpoint: "invoices",
  },
  payments: {
    title: "Pembayaran",
    description: "Penerimaan pelanggan, alokasi invoice, dan unapplied credit.",
    action: "Catat pembayaran",
    mode: "payment",
    endpoint: "payments",
  },
  attendance: {
    title: "Absensi saya",
    description: "Check-in dan check-out menggunakan waktu server.",
  },
  users: {
    title: "Pengguna & akses",
    description:
      "Kelola akun internal dan role. Perubahan berlaku pada request berikutnya.",
    action: "Tambah pengguna",
    mode: "user",
    endpoint: "users",
  },
  audit: {
    title: "Audit trail",
    description:
      "500 aktivitas terakhir. Riwayat bersifat append-only dan tidak dapat diedit.",
  },
};
type Payload = FormDataSources & { rows?: unknown[] };
type EditState = {
  title: string;
  description: string;
  mode: EditorMode;
  endpoint: string;
  initial?: Record<string, unknown>;
};
export function Workbench({
  module,
  actor,
  createOnLoad = false,
  initialSearch = "",
  initialRecord = "",
  initialStatus = "all",
}: {
  module: ModuleKey;
  actor: Actor;
  createOnLoad?: boolean;
  initialSearch?: string;
  initialRecord?: string;
  initialStatus?: string;
}) {
  const [payload, setPayload] = useState<Payload | Dashboard>({ rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(() => {
    const options: Partial<Record<ModuleKey, string[]>> = {
      jobs: ["draft", "assigned", "in_progress", "completed", "cancelled"],
      documents: ["submitted", "verified", "rejected"],
      invoices: [
        "draft",
        "issued",
        "outstanding",
        "unpaid",
        "partially_paid",
        "paid",
        "overdue",
        "void",
      ],
      quotations: ["draft", "approved", "rejected"],
      users: ["active", "inactive", "unassigned"],
    };
    return options[module]?.includes(initialStatus) ? initialStatus : "all";
  });
  const [period, setPeriod] = useState(defaultReportPeriod);
  const [range, setRange] = useState(() =>
    module === "dashboard" ? `?from=${period.from}&to=${period.to}` : "",
  );
  const [edit, setEdit] = useState<EditState | null>(null);
  const [view, setView] = useState<Invoice | Payment | AuditRow | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const config = meta[module];
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPayload(await api<Payload | Dashboard>(`data/${module}${range}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tidak dapat memuat data.");
    } finally {
      setLoading(false);
    }
  }, [module, range]);
  useEffect(() => {
    let active = true;
    api<Payload | Dashboard>(`data/${module}${range}`)
      .then((result) => {
        if (active) {
          setPayload(result);
          if (
            !autoOpened &&
            createOnLoad &&
            config.mode &&
            config.endpoint &&
            can(
              actor,
              (
                {
                  customer: "customersWrite",
                  request: "requestsWrite",
                  quotation: "quotationsWrite",
                  job: "jobsWrite",
                  billable: "billablesWrite",
                  draft: "invoicesWrite",
                  payment: "paymentsWrite",
                  user: "users",
                } as const
              )[
                config.mode as
                  | "customer"
                  | "request"
                  | "quotation"
                  | "job"
                  | "billable"
                  | "draft"
                  | "payment"
                  | "user"
              ],
            )
          ) {
            setEdit({
              title: config.action!,
              mode: config.mode,
              endpoint: config.endpoint,
              description: "Data divalidasi dan perubahan dicatat dalam audit.",
            });
            setAutoOpened(true);
          }
          if (
            !autoOpened &&
            initialRecord &&
            ["invoices", "payments"].includes(module) &&
            "rows" in result
          ) {
            const record = result.rows?.find(
              (row) => (row as { id: string }).id === initialRecord,
            );
            if (record) {
              setView(record as Invoice | Payment);
              setAutoOpened(true);
            } else
              setError(
                "Data tidak ditemukan. Gunakan pencarian atau muat ulang daftar.",
              );
          }
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Tidak dapat memuat data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [module, range, actor, autoOpened, createOnLoad, initialRecord, config]);
  const data = payload as Payload;
  const rows = data.rows ?? [];
  const sources: FormDataSources = {
    ...data,
    ...(module === "requests" ? { requests: rows as OrderRequest[] } : {}),
  };
  const open = (
    title: string,
    mode: EditorMode,
    endpoint: string,
    initial?: Record<string, unknown>,
    description = "Data divalidasi dan perubahan dicatat dalam audit.",
  ) => setEdit({ title, mode, endpoint, initial, description });
  let allowCreate = false;
  if (module === "customers") allowCreate = can(actor, "customersWrite");
  if (module === "requests") allowCreate = can(actor, "requestsWrite");
  if (module === "quotations") allowCreate = can(actor, "quotationsWrite");
  if (module === "jobs") allowCreate = can(actor, "jobsWrite");
  if (module === "billing") allowCreate = can(actor, "billablesWrite");
  if (module === "invoices") allowCreate = can(actor, "invoicesWrite");
  if (module === "payments") allowCreate = can(actor, "paymentsWrite");
  if (module === "users") allowCreate = can(actor, "users");
  const bySearch = <T,>(list: T[], label: (r: T) => string) =>
    filterRows(list, search, label);
  const actions = (...nodes: ReactNode[]) => (
    <div className="row-actions">{nodes}</div>
  );
  const money = (value: number, currency: string) => (
    <span className="money">{formatMoney(value, currency)}</span>
  );
  let content: ReactNode;
  let filters: Record<string, string> | undefined;
  switch (module) {
    case "customers": {
      filters = {
        all: "Semua customer",
        active: "Aktif",
        inactive: "Nonaktif",
      };
      const list = bySearch(
        rows as Customer[],
        (r) => `${r.name} ${r.contactName} ${r.email} ${r.phone}`,
      ).filter((r) => status === "all" || r.active === (status === "active"));
      content = (
        <DataTable
          rows={list}
          columns={[
            {
              title: "Customer",
              render: (r) => (
                <div>
                  <strong>{r.name}</strong>
                  <p className="text-kumo-subtle">{r.address}</p>
                </div>
              ),
            },
            {
              title: "Kontak",
              render: (r) => (
                <div>
                  {r.contactName}
                  <p className="text-kumo-subtle">
                    {r.email} · {r.phone}
                  </p>
                </div>
              ),
            },
            {
              title: "Status",
              render: (r) => (
                <Status value={r.active ? "active" : "inactive"} />
              ),
            },
            {
              title: "",
              render: (r) =>
                can(actor, "customersWrite") && (
                  <Button
                    size="sm"
                    onClick={() =>
                      open("Ubah customer", "customer", `customers/${r.id}`, {
                        ...r,
                      })
                    }
                  >
                    Ubah
                  </Button>
                ),
            },
          ]}
        />
      );
      break;
    }
    case "jobs": {
      filters = {
        all: "Semua status",
        draft: "Draft",
        assigned: "Ditugaskan",
        in_progress: "Dalam proses",
        completed: "Selesai",
        cancelled: "Dibatalkan",
      };
      const list = bySearch(
        rows as Job[],
        (r) =>
          `${r.number} ${r.customerName} ${r.origin} ${r.destination} ${r.picName}`,
      ).filter((r) => status === "all" || r.status === status);
      content = (
        <>
          <div className="context-strip">
            <span>
              {
                (rows as Job[]).filter(
                  (j) => !["completed", "cancelled"].includes(j.status),
                ).length
              }{" "}
              pekerjaan aktif
            </span>
            <span>
              {
                (rows as Job[]).filter(
                  (j) =>
                    new Date(j.dueAt) < new Date() &&
                    !["completed", "cancelled"].includes(j.status),
                ).length
              }{" "}
              melewati tenggat
            </span>
            <span>Waktu Asia/Jakarta</span>
          </div>
          <DataTable
            rows={list}
            empty="Buat job order dari customer, lalu tugaskan petugas lapangan."
            columns={[
              {
                title: "Job / customer",
                render: (r) => (
                  <div>
                    <Link className="record-link" href={`/jobs/${r.id}`}>
                      {r.number}
                    </Link>
                    <p>{r.customerName}</p>
                  </div>
                ),
              },
              {
                title: "Rute & pekerjaan",
                render: (r) => (
                  <div className="route-cell">
                    {r.origin}
                    <span className="text-kumo-subtle"> → </span>
                    {r.destination}
                    <p className="text-kumo-subtle">{r.description}</p>
                  </div>
                ),
              },
              {
                title: "PIC / petugas",
                render: (r) => (
                  <div>
                    {r.picName}
                    <p className="text-kumo-subtle">
                      {r.assignees.map((a) => a.name).join(", ") ||
                        "Belum ditugaskan"}
                    </p>
                  </div>
                ),
              },
              { title: "Tenggat", render: (r) => dateText(r.dueAt) },
              { title: "Status", render: (r) => <Status value={r.status} /> },
              {
                title: "Dokumen",
                render: (r) => (
                  <span>
                    {
                      r.documents.filter(
                        (d) =>
                          d.status === "verified" &&
                          !r.documents.some(
                            (n) => n.type === d.type && n.version > d.version,
                          ),
                      ).length
                    }{" "}
                    terverifikasi · {(checklists[r.serviceType] ?? []).length}{" "}
                    wajib
                    <p className="text-kumo-subtle">
                      {
                        r.documents.filter((d) => d.status === "submitted")
                          .length
                      }{" "}
                      menunggu review
                    </p>
                  </span>
                ),
              },
              {
                title: "",
                render: (r) => (
                  <Link
                    className="record-link"
                    href={`/jobs/${r.id}`}
                    aria-label={`Buka ${r.number}`}
                  >
                    <ArrowRightIcon size={18} />
                  </Link>
                ),
              },
            ]}
          />
        </>
      );
      break;
    }
    case "documents": {
      filters = {
        all: "Semua status",
        submitted: "Menunggu review",
        rejected: "Ditolak",
        verified: "Terverifikasi",
      };
      const list = bySearch(
        rows as Document[],
        (r) => `${r.filename} ${r.jobNumber} ${r.customerName}`,
      ).filter((r) => status === "all" || r.status === status);
      content = (
        <DataTable
          rows={list}
          empty="Unggah surat jalan dan bukti melalui halaman detail job yang ditugaskan."
          columns={[
            {
              title: "Dokumen",
              render: (r) => (
                <div>
                  <strong>{r.filename}</strong>
                  <p className="text-kumo-subtle">
                    Versi {r.version} · {Math.ceil(r.size / 1024)} KB · {r.type}
                  </p>
                </div>
              ),
            },
            {
              title: "Job / customer",
              render: (r) => (
                <div>
                  <Link className="record-link" href={`/jobs/${r.jobId}`}>
                    {r.jobNumber}
                  </Link>
                  <p>{r.customerName}</p>
                </div>
              ),
            },
            {
              title: "Review",
              render: (r) => (
                <div>
                  <Status value={r.status} />
                  <p className="text-kumo-subtle">
                    {r.reviewNote ?? "Periksa bukti sebelum verifikasi"}
                  </p>
                </div>
              ),
            },
            { title: "Diunggah", render: (r) => dateText(r.createdAt, true) },
            {
              title: "",
              render: (r) =>
                actions(
                  <Button
                    key="download"
                    size="sm"
                    icon={<DownloadSimpleIcon size={16} />}
                    onClick={() => download(r.id)}
                  >
                    Unduh
                  </Button>,
                  can(actor, "documentsReview") && r.status === "submitted" && (
                    <Button
                      key="review"
                      size="sm"
                      onClick={() =>
                        open(
                          "Review dokumen",
                          "review",
                          `documents/${r.id}/review`,
                          { status: "verified" },
                        )
                      }
                    >
                      Review
                    </Button>
                  ),
                ),
            },
          ]}
        />
      );
      break;
    }
    case "billing": {
      filters = {
        all: "Semua komponen",
        ready: "Siap ditagih",
        blocked: "Belum memenuhi syarat",
        pending: "Tarif belum disetujui",
      };
      const list = bySearch(
        rows as Billable[],
        (r) => `${r.description} ${r.jobNumber} ${r.customerName}`,
      ).filter(
        (r) =>
          status === "all" ||
          (status === "ready"
            ? r.blockers.length === 0 && r.available > 0
            : status === "pending"
              ? !r.approvedBy
              : r.blockers.length > 0),
      );
      content = (
        <DataTable
          rows={list}
          empty="Tambahkan komponen berdasarkan tarif, lalu catat persetujuannya."
          columns={[
            {
              title: "Komponen / job",
              render: (r) => (
                <div>
                  <strong>{r.description}</strong>
                  <p>
                    <Link className="record-link" href={`/jobs/${r.jobId}`}>
                      {r.jobNumber}
                    </Link>{" "}
                    · {r.customerName}
                  </p>
                  <p className="text-kumo-subtle">{r.basis}</p>
                </div>
              ),
            },
            {
              title: "Nominal",
              render: (r) => (
                <div>
                  {money(r.approvedAmount, r.currency)}
                  <p className="text-kumo-subtle">
                    Pajak {r.taxBps / 100}% · {r.termsDays} hari
                  </p>
                </div>
              ),
            },
            {
              title: "Saldo komponen",
              render: (r) => (
                <div>
                  {money(r.available, r.currency)}
                  <p className="text-kumo-subtle">
                    Ditagih {formatMoney(r.used, r.currency)}
                  </p>
                </div>
              ),
            },
            {
              title: "Kelayakan penerbitan",
              render: (r) => (
                <div className="blocker-cell">
                  <Status
                    value={r.blockers.length ? "submitted" : "approved"}
                  />
                  <p className="text-kumo-subtle">
                    {r.blockers.join("; ") ||
                      (r.available > 0
                        ? "Siap ditagih"
                        : "Sudah dialokasikan seluruhnya")}
                  </p>
                </div>
              ),
            },
            {
              title: "",
              render: (r) =>
                can(actor, "billablesWrite") &&
                !r.approvedBy && (
                  <Button
                    size="sm"
                    onClick={() =>
                      open(
                        "Setujui komponen tagihan",
                        "approval",
                        `billables/${r.id}/approve`,
                      )
                    }
                  >
                    Setujui tarif
                  </Button>
                ),
            },
          ]}
        />
      );
      break;
    }
    case "invoices": {
      filters = {
        all: "Semua invoice",
        issued: "Terbit",
        outstanding: "Masih berpiutang",
        draft: "Draft",
        unpaid: "Belum dibayar",
        partially_paid: "Dibayar sebagian",
        paid: "Lunas",
        overdue: "Lewat jatuh tempo",
        void: "Void",
      };
      const list = bySearch(
        rows as Invoice[],
        (r) => `${r.number ?? "draft"} ${r.customerName}`,
      ).filter(
        (r) =>
          status === "all" ||
          (status === "issued"
            ? r.status === "issued"
            : status === "outstanding"
              ? r.status === "issued" && r.outstanding > 0
              : r.paymentStatus === status),
      );
      content = (
        <DataTable
          rows={list}
          empty="Buat draft dari komponen tagihan satu customer dengan ketentuan yang sama."
          columns={[
            {
              title: "Invoice / customer",
              render: (r) => (
                <div>
                  <Button
                    variant="ghost"
                    className="record-link"
                    onClick={() => setView(r)}
                  >
                    {r.number ?? `Draft · ${r.id.slice(0, 8)}`}
                  </Button>
                  <p>{r.customerName}</p>
                  <p className="text-kumo-subtle">
                    {r.items.length} komponen ·{" "}
                    {new Set(r.items.map((i) => i.jobId)).size} job
                  </p>
                </div>
              ),
            },
            {
              title: "Total / saldo",
              render: (r) => (
                <div>
                  {money(r.total, r.currency)}
                  <p className="text-kumo-subtle">
                    Piutang {formatMoney(r.outstanding, r.currency)}
                  </p>
                </div>
              ),
            },
            { title: "Jatuh tempo", render: (r) => dateText(r.dueAt) },
            {
              title: "Status",
              render: (r) => (
                <div>
                  <Status value={r.paymentStatus} />
                  {r.status === "draft" && (
                    <p className="text-kumo-subtle blocker-cell">
                      {r.blockers.length
                        ? `${r.blockers.length} syarat belum terpenuhi`
                        : "Siap diterbitkan"}
                    </p>
                  )}
                </div>
              ),
            },
            {
              title: "",
              render: (r) =>
                actions(
                  <Button key="detail" size="sm" onClick={() => setView(r)}>
                    Detail
                  </Button>,
                  can(actor, "invoicesWrite") && r.status === "draft" && (
                    <Button
                      key="issue"
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        open(
                          "Terbitkan invoice",
                          "issue",
                          `invoices/${r.id}/issue`,
                        )
                      }
                    >
                      Terbitkan
                    </Button>
                  ),
                ),
            },
          ]}
        />
      );
      break;
    }
    case "payments": {
      const list = bySearch(
        rows as Payment[],
        (r) => `${r.reference} ${r.customerName} ${r.method}`,
      );
      content = (
        <DataTable
          rows={list}
          columns={[
            {
              title: "Referensi / customer",
              render: (r) => (
                <div>
                  <Button
                    variant="ghost"
                    className="record-link"
                    onClick={() => setView(r)}
                  >
                    {r.reference}
                  </Button>
                  <p>{r.customerName}</p>
                </div>
              ),
            },
            { title: "Penerimaan", render: (r) => money(r.amount, r.currency) },
            {
              title: "Teralokasi",
              render: (r) => (
                <div>
                  {money(r.allocated, r.currency)}
                  <p className="text-kumo-subtle">
                    {r.allocations.map((a) => a.number).join(", ") ||
                      "Belum dialokasikan"}
                  </p>
                </div>
              ),
            },
            {
              title: "Unapplied credit",
              render: (r) => money(r.unapplied, r.currency),
            },
            {
              title: "Diterima / metode",
              render: (r) => (
                <div>
                  {dateText(r.receivedAt)}
                  <p className="text-kumo-subtle">
                    {r.method.replaceAll("_", " ")}
                  </p>
                </div>
              ),
            },
            {
              title: "",
              render: (r) =>
                can(actor, "paymentsWrite") &&
                r.unapplied > 0 && (
                  <Button
                    size="sm"
                    onClick={() =>
                      open(
                        "Alokasikan saldo pembayaran",
                        "allocation",
                        `payments/${r.id}/allocate`,
                        { customerId: r.customerId, currency: r.currency },
                      )
                    }
                  >
                    Alokasikan
                  </Button>
                ),
            },
          ]}
        />
      );
      break;
    }
    case "quotations": {
      filters = {
        all: "Semua penawaran",
        draft: "Draft",
        approved: "Disetujui",
        rejected: "Ditolak",
      };
      const list = bySearch(
        rows as Quotation[],
        (r) => `${r.title} ${r.customerName} ${r.description}`,
      ).filter((r) => status === "all" || r.status === status);
      content = (
        <DataTable
          rows={list}
          columns={[
            {
              title: "Penawaran",
              render: (r) => (
                <div>
                  <strong>{r.title}</strong>
                  <p className="text-kumo-subtle">
                    {r.customerName} · revisi {r.revision}
                  </p>
                  <p>{r.description}</p>
                </div>
              ),
            },
            {
              title: "Tarif / ketentuan",
              render: (r) => (
                <div>
                  {money(r.amount, r.currency)}
                  <p className="text-kumo-subtle">
                    Pajak {r.taxBps / 100}% · {r.termsDays} hari
                  </p>
                </div>
              ),
            },
            {
              title: "Persetujuan",
              render: (r) => (
                <div>
                  <Status value={r.status} />
                  <p className="text-kumo-subtle">
                    {r.approvalNote ?? "Menunggu Finance"}
                  </p>
                </div>
              ),
            },
            {
              title: "",
              render: (r) =>
                actions(
                  can(actor, "quotationsApprove") && r.status === "draft" && (
                    <Button
                      key="approve"
                      size="sm"
                      onClick={() =>
                        open(
                          "Setujui penawaran",
                          "approval",
                          `quotations/${r.id}/approve`,
                        )
                      }
                    >
                      Setujui
                    </Button>
                  ),
                  can(actor, "quotationsWrite") && (
                    <Button
                      key="revise"
                      size="sm"
                      onClick={() =>
                        open("Revisi penawaran", "quotation", "quotations", {
                          ...r,
                          supersedesId: r.id,
                        })
                      }
                    >
                      Buat revisi
                    </Button>
                  ),
                ),
            },
          ]}
        />
      );
      break;
    }
    case "requests": {
      const list = bySearch(
        rows as OrderRequest[],
        (r) => `${r.description} ${r.customerName} ${r.source}`,
      );
      content = (
        <DataTable
          rows={list}
          columns={[
            { title: "Customer", render: (r) => r.customerName },
            { title: "Permintaan", render: (r) => r.description },
            { title: "Sumber", render: (r) => r.source },
            {
              title: "Dasar tarif",
              render: (r) =>
                r.quotationId
                  ? "Penawaran disetujui"
                  : "Persetujuan tarif per komponen",
            },
            { title: "Dicatat", render: (r) => dateText(r.createdAt) },
            {
              title: "",
              render: (r) =>
                can(actor, "jobsWrite") && (
                  <Button
                    size="sm"
                    onClick={() =>
                      open("Buat job dari permintaan", "job", "jobs", {
                        customerId: r.customerId,
                        requestId: r.id,
                        source: r.source,
                        description: r.description,
                      })
                    }
                  >
                    Buat job
                  </Button>
                ),
            },
          ]}
        />
      );
      break;
    }
    case "users": {
      filters = {
        all: "Semua pengguna",
        active: "Aktif",
        inactive: "Nonaktif",
        unassigned: "Aktif tanpa role",
      };
      const list = bySearch(
        rows as UserRow[],
        (r) => `${r.name} ${r.email} ${r.roles.join(" ")}`,
      ).filter(
        (r) =>
          status === "all" ||
          (status === "unassigned"
            ? r.active && !r.roles.length
            : r.active === (status === "active")),
      );
      content = (
        <DataTable
          rows={list}
          columns={[
            {
              title: "Pengguna",
              render: (r) => (
                <div>
                  <strong>{r.name}</strong>
                  <p className="text-kumo-subtle">{r.email}</p>
                </div>
              ),
            },
            {
              title: "Role",
              render: (r) => r.roles.map((k) => roleLabels[k]).join(" · "),
            },
            {
              title: "Akun",
              render: (r) => (
                <Status value={r.active ? "active" : "inactive"} />
              ),
            },
            {
              title: "",
              render: (r) => (
                <Button
                  size="sm"
                  onClick={() =>
                    open(
                      "Ubah akses pengguna",
                      "roles",
                      `users/${r.id}/roles`,
                      { ...r },
                    )
                  }
                >
                  Kelola akses
                </Button>
              ),
            },
          ]}
        />
      );
      break;
    }
    case "audit": {
      const list = bySearch(
        rows as AuditRow[],
        (r) => `${r.actorName} ${r.entity} ${r.action} ${r.entityId}`,
      );
      content = (
        <DataTable
          rows={list}
          columns={[
            { title: "Waktu", render: (r) => dateText(r.createdAt, true) },
            { title: "Pelaku", render: (r) => r.actorName },
            {
              title: "Entitas",
              render: (r) => (
                <div>
                  {r.entity}
                  <p className="text-kumo-subtle font-mono">
                    {r.entityId.slice(0, 8)}
                  </p>
                </div>
              ),
            },
            { title: "Tindakan", render: (r) => r.action.replaceAll("_", " ") },
            {
              title: "",
              render: (r) => (
                <Button size="sm" onClick={() => setView(r)}>
                  Perubahan
                </Button>
              ),
            },
          ]}
        />
      );
      break;
    }
    case "attendance": {
      const list = rows as Attendance[];
      const active = list.find((r) => !r.checkOut);
      content = (
        <>
          <div className="attendance-action">
            <div>
              <h3>
                {active ? "Anda sedang check-in" : "Mulai hari kerja Anda"}
              </h3>
              <p className="text-kumo-subtle">
                {active
                  ? `Sejak ${dateText(active.checkIn, true)}`
                  : "Waktu dicatat otomatis oleh server."}
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() =>
                open(
                  active ? "Check-out" : "Check-in",
                  "attendance",
                  "attendance",
                  { kind: active ? "out" : "in" },
                )
              }
            >
              {active ? "Check-out" : "Check-in"}
            </Button>
          </div>
          <DataTable
            rows={list}
            columns={[
              { title: "Check-in", render: (r) => dateText(r.checkIn, true) },
              { title: "Check-out", render: (r) => dateText(r.checkOut, true) },
              { title: "Catatan", render: (r) => r.note || "—" },
            ]}
          />
        </>
      );
      break;
    }
    case "dashboard":
      content =
        "currencies" in payload ? <DashboardView data={payload} /> : null;
      break;
  }
  async function download(id: string) {
    setError("");
    try {
      const response = await fetch(`/api/documents/${id}/download`);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error);
      }
      const blob = await response.blob();
      const row = (rows as Document[]).find((r) => r.id === id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = row?.filename ?? "document";
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unduh gagal.");
    }
  }
  function exportData() {
    const exportRows =
      module === "dashboard" && "currencies" in payload
        ? payload.currencies.map((c) => ({
            currency: c.currency,
            billed_period: c.billed / 100,
            receipts_period: c.receipts / 100,
            outstanding_now: c.outstanding / 100,
            overdue_now: c.overdue / 100,
            unapplied_now: c.unapplied / 100,
            from: payload.period.from,
            to: payload.period.to,
          }))
        : (rows as Record<string, unknown>[]);
    if (!exportRows.length) return;
    const keys = Object.keys(exportRows[0]).filter(
      (k) => !["customerSnapshot", "before", "after"].includes(k),
    );
    const escape = (value: unknown) => {
      let text =
        typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const csv =
      "\uFEFF" +
      [
        keys.map(escape).join(","),
        ...exportRows.map((row) =>
          keys
            .map((k) => escape((row as Record<string, unknown>)[k]))
            .join(","),
        ),
      ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `sgi-${module}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeader
        title={config.title}
        template={module === "dashboard" ? "report" : "standard"}
        description={config.description}
        context={
          ["jobs", "documents"].includes(module)
            ? "Operasional"
            : ["invoices", "payments", "billing"].includes(module)
              ? "Keuangan"
              : "Workspace SGI"
        }
        actions={
          <>
            {" "}
            <Refresh loading={loading} onClick={() => void load()} />
            {allowCreate && config.mode && (
              <Button
                variant="primary"
                icon={<PlusIcon size={16} />}
                disabled={loading}
                onClick={() =>
                  open(config.action!, config.mode!, config.endpoint!)
                }
              >
                {config.action}
              </Button>
            )}
          </>
        }
      />
      <Feedback error={error} success={success} />
      <ModuleSurface
        dashboard={module === "dashboard"}
        title={
          module === "attendance"
            ? "Kehadiran & riwayat"
            : `Daftar ${config.title.toLowerCase()}`
        }
        count={rows.length}
      >
        {module === "dashboard" ? (
          <LayerCard className="filter-bar period-bar">
            <ReportPeriod
              from={period.from}
              to={period.to}
              loading={loading}
              onApply={(from, to) => {
                setPeriod({ from, to });
                const nextRange = `?from=${from}&to=${to}`;
                if (nextRange === range) void load();
                else {
                  setLoading(true);
                  setError("");
                  setRange(nextRange);
                }
              }}
            />
            <Button
              type="button"
              icon={<DownloadSimpleIcon size={16} />}
              onClick={exportData}
              disabled={loading || Boolean(error)}
            >
              Ekspor laporan
            </Button>
          </LayerCard>
        ) : (
          module !== "attendance" && (
            <div className="filter-bar">
              <div className="search-input">
                <MagnifyingGlassIcon size={17} />
                <Input
                  aria-label="Cari data"
                  placeholder={`Cari ${config.title.toLowerCase()}…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {filters && (
                <Select<string>
                  aria-label="Filter status"
                  value={status}
                  onValueChange={(v) => setStatus(v ?? "all")}
                  items={filters}
                />
              )}
              {["audit", "invoices", "payments", "billing"].includes(
                module,
              ) && (
                <Button
                  size="sm"
                  icon={<DownloadSimpleIcon size={16} />}
                  onClick={exportData}
                  disabled={loading || !rows.length}
                >
                  Ekspor CSV
                </Button>
              )}
            </div>
          )
        )}
        {loading &&
        (module === "dashboard" ||
          (!rows.length && !("currencies" in payload))) ? (
          <LoadingState
            text={module === "dashboard" ? "Memperbarui laporan…" : undefined}
          />
        ) : module === "dashboard" && error ? null : (
          <div>{content}</div>
        )}
      </ModuleSurface>
      <Modal
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={edit?.title ?? "Ubah data"}
        description={edit?.description ?? ""}
      >
        {edit && (
          <Editor
            key={`${edit.mode}-${edit.endpoint}`}
            mode={edit.mode}
            endpoint={edit.endpoint}
            sources={sources}
            initial={edit.initial}
            onCancel={() => setEdit(null)}
            onSaved={() => {
              setEdit(null);
              setView(null);
              setSuccess("Perubahan berhasil disimpan.");
              void load();
            }}
          />
        )}
      </Modal>
      <Modal
        open={view !== null}
        onClose={() => setView(null)}
        title={
          module === "audit"
            ? "Detail perubahan"
            : module === "payments"
              ? "Detail pembayaran"
              : "Detail invoice"
        }
        description="Catatan transaksi dan saldo dihitung dari sumber data."
      >
        {view &&
          (module === "invoices" ? (
            <InvoiceView
              invoice={view as Invoice}
              actor={actor}
              onEdit={(mode, action, initial) => {
                const i = view as Invoice;
                setView(null);
                open(
                  mode === "draft"
                    ? "Ubah draft invoice"
                    : mode === "correction"
                      ? "Koreksi invoice"
                      : "Hapus draft",
                  mode,
                  `invoices/${i.id}${action ? `/${action}` : ""}`,
                  initial,
                );
              }}
            />
          ) : module === "payments" ? (
            <PaymentView payment={view as Payment} />
          ) : (
            <AuditView audit={view as AuditRow} />
          ))}
      </Modal>
    </>
  );
}
function ModuleSurface({
  dashboard,
  title,
  count,
  children,
}: {
  dashboard: boolean;
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (dashboard) return <>{children}</>;
  return (
    <CollectionPanel title={title} count={count}>
      {children}
    </CollectionPanel>
  );
}

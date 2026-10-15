"use client";
import { ToolbarAction } from "./toolbar-action";
import {
  Badge,
  Button,
  Grid,
  GridItem,
  LayerCard,
  LinkButton,
  Meter,
  Select,
  Text,
} from "@cloudflare/kumo";
import {
  ArrowRightIcon,
  CameraIcon,
  DownloadSimpleIcon,
} from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { Actor, formatMoney, Role, roleLabels } from "@/lib/domain";
import { defaultReportPeriod } from "@/lib/report-period";
import type { WorkspaceData } from "@/modules/workspace";
import type { Serialized } from "./types";

import { DashboardView } from "./dashboard";
import { WorkspaceChart } from "./workspace-chart";

import { ReportPeriod } from "./report-period";
import {
  api,
  DataTable,
  dateText,
  Feedback,
  SectionPanel,
  Status,
} from "./shared";
import { LoadingState, RecordFacts } from "./workspace-ui";
import { useLiveRevision } from "@/lib/live-data";
import { SystemOverview } from "./system-overview";
import { usePhoneLayout } from "@/lib/phone-layout";
type Data = Serialized<WorkspaceData>;
type Of<R extends Role> = Extract<Data, { role: R }>;
const active = (status: string) => !["completed", "cancelled"].includes(status);
function JobLink({ id, number }: { id: string; number: string }) {
  return (
    <LinkButton variant="ghost" href={`/jobs/${id}`} className="record-link">
      {number}
    </LinkButton>
  );
}
export function RoleDashboard({
  actor,
  role,
  presentation = "analytics",
  homepageTools,
}: {
  actor: Actor;
  role: Role;
  presentation?: "dashboard" | "analytics";
  homepageTools?: (data: Data | undefined) => ReactNode;
}) {
  const liveRevision = useLiveRevision();
  const mobile = usePhoneLayout();
  const [data, setData] = useState<Data>();
  const [period, setPeriod] = useState(defaultReportPeriod);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams();
    if (role === "director") {
      params.set("from", period.from);
      params.set("to", period.to);
    }
    api<Data>(`data/dashboard${params.size ? `?${params}` : ""}`)
      .then((result) => {
        if (result.role !== role)
          throw new Error("Akses Anda berubah. Muat ulang halaman.");
        if (alive) {
          setData(result);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [actor, role, period.from, period.to, revision, liveRevision]);
  function apply(from: string, to: string) {
    setLoading(true);
    setError("");
    setPeriod({ from, to });
    setRevision((r) => r + 1);
  }
  function exportReport() {
    if (!data || data.role !== "director") return;
    const rows = data.currencies.map((c) => [
      c.currency,
      c.billed / 100,
      c.receipts / 100,
      c.outstanding / 100,
      c.overdue / 100,
      c.unapplied / 100,
      data.period.from,
      data.period.to,
    ]);
    const encode = (value: unknown) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const csv =
      "\uFEFF" +
      [
        [
          "currency",
          "billed_period",
          "receipts_period",
          "outstanding_now",
          "overdue_now",
          "unapplied_now",
          "from",
          "to",
        ],
        ...rows,
      ]
        .map((row) => row.map(encode).join(","))
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `sgi-dashboard-${period.from}-${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div
      className={`role-dashboard role-dashboard-${role}`}
      data-workspace-role={role}
      aria-busy={loading || (data?.role !== role && !error)}
    >
      {presentation === "dashboard" &&
        homepageTools?.(data?.role === role ? data : undefined)}
      <Feedback error={error} />
      {(role === "director" || presentation === "analytics") &&
        (presentation !== "analytics" || mobile) && (
          <LayerCard className="filter-bar period-bar">
            <ReportPeriod
              from={period.from}
              to={period.to}
              loading={loading}
              onApply={apply}
            />
            {role === "director" && (
              <ToolbarAction
                aria-label="Ekspor laporan"
                className="toolbar-icon-export"
                icon={<DownloadSimpleIcon size={18} />}
                onClick={exportReport}
                disabled={!data || loading || Boolean(error)}
              >
                Ekspor laporan
              </ToolbarAction>
            )}
          </LayerCard>
        )}
      {(loading || data?.role !== role) &&
      !error &&
      (!data || data.role !== role) ? (
        <LoadingState
          text={`Memuat ${presentation === "dashboard" ? "dashboard" : "analitik"}…`}
        />
      ) : error || !data || data.role !== role ? null : (
        <div className="role-dashboard-content">
          {presentation === "analytics" ? (
            <WorkspaceChart
              data={data}
              period={period}
              controls={
                !mobile && (
                  <>
                    <ReportPeriod
                      from={period.from}
                      to={period.to}
                      loading={loading}
                      onApply={apply}
                    />
                    {role === "director" && (
                      <Button
                        aria-label="Ekspor laporan"
                        title="Ekspor laporan"
                        shape="square"
                        variant="outline"
                        className="desktop-filter-trigger"
                        icon={<DownloadSimpleIcon size={18} />}
                        onClick={exportReport}
                        disabled={loading || Boolean(error)}
                      />
                    )}
                  </>
                )
              }
            />
          ) : data.role === "director" ? (
            <DashboardView data={data} />
          ) : data.role === "operations" ? (
            <Operations data={data} />
          ) : data.role === "field" ? (
            <Field data={data} />
          ) : data.role === "finance" ? (
            <Finance data={data} />
          ) : data.role === "sales" ? (
            <Sales data={data} />
          ) : (
            <Admin data={data} />
          )}
        </div>
      )}
    </div>
  );
}
function Operations({ data: d }: { data: Of<"operations"> }) {
  const jobs = d.jobs
    .filter((j) => active(j.status))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return (
    <>
      <SectionPanel
        title="Penugasan pekerjaan"
        action={
          <LinkButton variant="primary" href="/jobs?create=1">
            Buat job order
          </LinkButton>
        }
      >
        <div className="dashboard-meter">
          <Meter
            label="Job aktif ditugaskan"
            max={Math.max(jobs.length, 1)}
            value={jobs.filter((j) => j.assignees.length > 0).length}
            customValue={`${jobs.filter((j) => j.assignees.length > 0).length} / ${jobs.length} job`}
          />
        </div>
        <DataTable
          rows={jobs}
          perPage={5}
          empty="Tidak ada pekerjaan aktif. Buat job untuk order berikutnya."
          columns={[
            {
              title: "Job",
              render: (r) => (
                <>
                  <JobLink id={r.id} number={r.number} />
                  <p>{r.customerName}</p>
                </>
              ),
            },
            {
              title: "PIC / petugas",
              render: (r) => (
                <>
                  {r.picName}
                  <p>
                    {r.assignees.map((a) => a.name).join(", ") ||
                      "Belum ditugaskan"}
                  </p>
                </>
              ),
            },
            { title: "Status", render: (r) => <Status value={r.status} /> },
            { title: "Tenggat", render: (r) => dateText(r.dueAt) },
          ]}
        />
      </SectionPanel>
      <Grid variant="2up" gap="sm" className="dashboard-support-grid">
        <GridItem>
          <SectionPanel
            title="Bukti menunggu review"
            description={`${d.reviews.length} dokumen perlu diperiksa`}
          >
            <DataTable
              rows={d.reviews}
              perPage={4}
              empty="Tidak ada dokumen menunggu review."
              columns={[
                {
                  title: "Dokumen",
                  render: (r) => (
                    <>
                      {r.filename}
                      <p>{r.jobNumber}</p>
                    </>
                  ),
                },
                {
                  title: "Aksi",
                  render: (r) => (
                    <LinkButton
                      href={`/documents?q=${encodeURIComponent(r.filename)}`}
                      variant="primary"
                      size="sm"
                    >
                      Review
                    </LinkButton>
                  ),
                },
              ]}
            />
          </SectionPanel>
        </GridItem>
        <GridItem>
          <SectionPanel title="Laporan dari lapangan">
            <DataTable
              rows={d.reports}
              perPage={4}
              empty="Petugas belum mengirim laporan pekerjaan."
              columns={[
                {
                  title: "Laporan",
                  render: (r) => (
                    <>
                      {r.jobNumber}
                      <p>{r.note}</p>
                    </>
                  ),
                },
                {
                  title: "Petugas",
                  render: (r) => (
                    <>
                      {r.actorName}
                      <p>{dateText(r.createdAt, true)}</p>
                    </>
                  ),
                },
                {
                  title: "",
                  render: (r) => (
                    <LinkButton
                      href={`/reports?q=${encodeURIComponent(r.note)}`}
                      size="sm"
                    >
                      Lihat
                    </LinkButton>
                  ),
                },
              ]}
            />
          </SectionPanel>
        </GridItem>
      </Grid>
    </>
  );
}
function Field({ data: d }: { data: Of<"field"> }) {
  const jobs = d.jobs
    .filter((j) => active(j.status))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return (
    <>
      <SectionPanel
        title="Tugas aktif saya"
        description={`${jobs.length} tugas aktif`}
      >
        {!jobs.length ? (
          <div className="empty">
            <Text>
              Belum ada tugas aktif. Hubungi Operations untuk penugasan
              berikutnya.
            </Text>
          </div>
        ) : (
          <div className="field-task-list">
            {jobs.map((job) => (
              <article key={job.id} className="field-task">
                <div className="field-task-heading">
                  <JobLink id={job.id} number={job.number} />
                  <Status value={job.status} />
                </div>
                <Text>{job.customerName}</Text>
                <Text variant="secondary">
                  {job.origin} → {job.destination}
                </Text>
                <div className="field-task-meta">
                  <Text>Tenggat {dateText(job.dueAt)}</Text>
                  <LinkButton
                    variant="primary"
                    href={`/reports?create=1&job=${job.id}`}
                    icon={<CameraIcon size={18} />}
                  >
                    Buat laporan
                  </LinkButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionPanel>
      <SectionPanel title="Kehadiran dan laporan saya">
        <RecordFacts
          items={[
            {
              label: "Check-in terakhir",
              value: dateText(d.attendance[0]?.checkIn, true),
            },
            {
              label: "Check-out",
              value: d.attendance[0]?.checkOut
                ? dateText(d.attendance[0].checkOut, true)
                : d.attendance.length
                  ? "Belum check-out"
                  : "Belum check-in",
            },
            { label: "Laporan tercatat", value: d.reports.length },
          ]}
        />
        <div className="dashboard-inline-actions">
          <LinkButton href="/attendance">Buka absensi</LinkButton>
          <LinkButton href="/reports">Riwayat laporan</LinkButton>
        </div>
        <DataTable
          rows={d.reports}
          perPage={3}
          empty="Buat laporan untuk mencatat pekerjaan."
          columns={[
            {
              title: "Pekerjaan",
              render: (r) => (
                <>
                  {r.jobNumber}
                  <p>{r.note}</p>
                </>
              ),
            },
            { title: "Waktu", render: (r) => dateText(r.createdAt, true) },
            {
              title: "Lampiran",
              render: (r) => (r.hasPhoto ? "Dengan foto" : "Catatan"),
            },
          ]}
        />
      </SectionPanel>
    </>
  );
}
function Finance({ data: d }: { data: Of<"finance"> }) {
  const [currency, setCurrency] = useState("IDR");
  const invoices = d.invoices.filter((i) => i.currency === currency);
  const drafts = invoices.filter((i) => i.status === "draft");
  const receivables = invoices.filter(
    (i) => i.status === "issued" && i.outstanding > 0,
  );
  const unapplied = d.payments.filter(
    (p) => p.currency === currency && p.unapplied > 0,
  );
  return (
    <>
      <SectionPanel
        title="Posisi piutang"
        action={
          <Select<string>
            aria-label="Mata uang finance"
            value={currency}
            onValueChange={(v) => setCurrency(v ?? "IDR")}
            items={{ IDR: "IDR", USD: "USD", SGD: "SGD" }}
          />
        }
      >
        <RecordFacts
          items={[
            {
              label: "Saldo piutang",
              value: formatMoney(
                receivables.reduce((sum, i) => sum + i.outstanding, 0),
                currency,
              ),
            },
            {
              label: "Lewat jatuh tempo",
              value: formatMoney(
                receivables
                  .filter((i) => i.paymentStatus === "overdue")
                  .reduce((sum, i) => sum + i.outstanding, 0),
                currency,
              ),
            },
            {
              label: "Saldo belum dialokasikan",
              value: formatMoney(
                unapplied.reduce((sum, p) => sum + p.unapplied, 0),
                currency,
              ),
            },
          ]}
        />
        <DataTable
          rows={receivables}
          perPage={5}
          empty="Tidak ada piutang dalam mata uang ini."
          columns={[
            {
              title: "Invoice / customer",
              render: (r) => (
                <div>
                  <LinkButton
                    variant="ghost"
                    href={`/invoices?record=${r.id}`}
                    className="record-link"
                  >
                    {r.number}
                  </LinkButton>
                  <p>{r.customerName}</p>
                </div>
              ),
            },
            {
              title: "Status",
              render: (r) => <Status value={r.paymentStatus} />,
            },
            {
              title: "Saldo",
              render: (r) => formatMoney(r.outstanding, r.currency),
            },
            { title: "Jatuh tempo", render: (r) => dateText(r.dueAt) },
          ]}
        />
      </SectionPanel>
      <Grid variant="2up" gap="sm" className="dashboard-support-grid">
        <GridItem>
          <SectionPanel
            title="Draft perlu ditindaklanjuti"
            description={`${drafts.length} draft`}
            action={
              <LinkButton variant="primary" href="/invoices?create=1">
                Buat invoice
              </LinkButton>
            }
          >
            <DataTable
              rows={drafts}
              perPage={4}
              empty="Tidak ada draft pada mata uang ini."
              columns={[
                {
                  title: "Customer",
                  render: (r) => (
                    <>
                      {r.customerName}
                      <p>{formatMoney(r.total, r.currency)}</p>
                    </>
                  ),
                },
                {
                  title: "Kesiapan",
                  render: (r) =>
                    r.blockers.length
                      ? r.blockers.join("; ")
                      : r.items.length
                        ? "Siap divalidasi"
                        : "Tambahkan komponen",
                },
                {
                  title: "",
                  render: (r) => (
                    <LinkButton href={`/invoices?record=${r.id}`} size="sm">
                      Buka draft
                    </LinkButton>
                  ),
                },
              ]}
            />
          </SectionPanel>
        </GridItem>
        <GridItem>
          <SectionPanel
            title="Penerimaan belum dialokasi"
            action={
              <LinkButton variant="primary" href="/payments?create=1">
                Catat pembayaran
              </LinkButton>
            }
          >
            <DataTable
              rows={unapplied}
              perPage={4}
              empty="Semua penerimaan dalam mata uang ini sudah dialokasikan."
              columns={[
                {
                  title: "Referensi",
                  render: (r) => (
                    <>
                      {r.reference}
                      <p>{r.customerName}</p>
                    </>
                  ),
                },
                {
                  title: "Credit",
                  render: (r) => formatMoney(r.unapplied, r.currency),
                },
                {
                  title: "",
                  render: (r) => (
                    <LinkButton href={`/payments?record=${r.id}`} size="sm">
                      Alokasikan
                    </LinkButton>
                  ),
                },
              ]}
            />
          </SectionPanel>
        </GridItem>
      </Grid>
    </>
  );
}
function Sales({ data: d }: { data: Of<"sales"> }) {
  const draft = d.quotations.filter((q) => q.status === "draft");
  const approved = d.quotations.filter((q) => q.status === "approved");
  return (
    <>
      <SectionPanel
        title="Pipeline penawaran"
        action={
          <LinkButton variant="primary" href="/requests?create=1">
            Catat order
          </LinkButton>
        }
      >
        <Grid variant="3up" gap="sm" className="sales-pipeline">
          {[
            {
              title: "Permintaan tercatat",
              count: d.requests.length,
              items: d.requests.slice(0, 4).map((r) => ({
                id: r.id,
                customer: r.customerName,
                note: r.description,
                href: `/requests?q=${encodeURIComponent(r.description)}`,
              })),
            },
            {
              title: "Penawaran draft",
              count: draft.length,
              items: draft.slice(0, 4).map((q) => ({
                id: q.id,
                customer: q.customerName,
                note: q.title,
                href: `/quotations?q=${encodeURIComponent(q.title)}`,
              })),
            },
            {
              title: "Tarif disetujui",
              count: approved.length,
              items: approved.slice(0, 4).map((q) => ({
                id: q.id,
                customer: q.customerName,
                note: q.title,
                href: `/quotations?q=${encodeURIComponent(q.title)}`,
              })),
            },
          ].map((lane) => (
            <GridItem key={lane.title}>
              <div className="pipeline-lane">
                <div className="pipeline-heading">
                  <Text as="h3" variant="heading">
                    {lane.title}
                  </Text>
                  <Badge className="sgi-badge" variant="secondary">
                    {lane.count}
                  </Badge>
                </div>
                {lane.items.length ? (
                  lane.items.map((item) => (
                    <LinkButton
                      key={item.id}
                      href={item.href}
                      variant="ghost"
                      className="pipeline-record"
                    >
                      <Text>{item.customer}</Text>
                      <Text variant="secondary">{item.note}</Text>
                    </LinkButton>
                  ))
                ) : (
                  <Text variant="secondary">
                    Belum ada data pada tahap ini.
                  </Text>
                )}
              </div>
            </GridItem>
          ))}
        </Grid>
      </SectionPanel>
      <SectionPanel
        title="Relasi pelanggan"
        description={`${d.customers.filter((c) => c.active).length} customer aktif`}
        action={
          <LinkButton href="/customers?create=1" variant="primary">
            Tambah customer
          </LinkButton>
        }
      >
        <DataTable
          rows={d.customers.filter((c) => c.active)}
          perPage={5}
          columns={[
            { title: "Customer", render: (r) => r.name },
            {
              title: "Kontak",
              render: (r) => (
                <>
                  {r.contactName}
                  <p>{r.email}</p>
                </>
              ),
            },
            {
              title: "",
              render: (r) => (
                <LinkButton
                  href={`/customers?q=${encodeURIComponent(r.name)}`}
                  size="sm"
                >
                  Lihat relasi
                </LinkButton>
              ),
            },
          ]}
        />
      </SectionPanel>
    </>
  );
}
function Admin({ data: d }: { data: Of<"admin"> }) {
  const users = d.users.filter((u) => u.active);
  return (
    <>
      <SystemOverview data={d.system} compact />
      <SectionPanel
        title="Akses pengguna aktif"
        action={
          <LinkButton variant="primary" href="/users?create=1">
            Tambah pengguna
          </LinkButton>
        }
      >
        <div className="dashboard-meter">
          <Meter
            label="Akun aktif dengan role"
            value={users.filter((u) => u.roles.length).length}
            max={Math.max(users.length, 1)}
            customValue={`${users.filter((u) => u.roles.length).length} / ${users.length} akun`}
          />
        </div>
        <DataTable
          rows={d.users}
          perPage={6}
          columns={[
            {
              title: "Pengguna",
              render: (r) => (
                <>
                  {r.name}
                  <p>{r.email}</p>
                </>
              ),
            },
            {
              title: "Peran",
              render: (r) =>
                r.roles.map((role) => roleLabels[role]).join(", ") ||
                "Belum ada peran",
            },
            {
              title: "Status",
              render: (r) => (
                <Status value={r.active ? "active" : "inactive"} />
              ),
            },
            {
              title: "",
              render: (r) => (
                <LinkButton
                  href={`/users?q=${encodeURIComponent(r.email)}`}
                  size="sm"
                >
                  Kelola akses
                </LinkButton>
              ),
            },
          ]}
        />
      </SectionPanel>
      <SectionPanel
        title="Perubahan akses terbaru"
        action={
          <LinkButton href="/audit" icon={<ArrowRightIcon size={16} />}>
            Buka audit
          </LinkButton>
        }
      >
        <DataTable
          rows={d.audit}
          perPage={5}
          empty="Belum ada perubahan akun yang tercatat."
          columns={[
            { title: "Aksi", render: (r) => r.action },
            { title: "Pelaku", render: (r) => r.actorName },
            { title: "Waktu", render: (r) => dateText(r.createdAt, true) },
          ]}
        />
      </SectionPanel>
    </>
  );
}

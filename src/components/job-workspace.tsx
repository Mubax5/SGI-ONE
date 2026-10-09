"use client";
import Link from "next/link";
import { Button, LayerCard, Tabs } from "@cloudflare/kumo";
import {
  ArrowLeftIcon,
  PlusIcon,
  UploadSimpleIcon,
  DownloadSimpleIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  ClipboardTextIcon,
  PathIcon,
  CurrencyCircleDollarIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import {
  Actor,
  can,
  checklists,
  documentTypes,
  formatMoney,
  services,
  statuses,
  transitions,
} from "@/lib/domain";
import {
  api,
  DataTable,
  dateText,
  Feedback,
  Modal,
  Refresh,
  Status,
  SectionPanel,
} from "./shared";
import { Editor, EditorMode } from "./editor";
import { LoadingState, PageHeader, RecordFacts } from "./workspace-ui";
import type { FormDataSources, JobDetail } from "./types";
export function JobWorkspace({ id, actor }: { id: string; actor: Actor }) {
  const [job, setJob] = useState<JobDetail>();
  const mayWork = Boolean(
    actor.roles.includes("operations") ||
    job?.assignees.some((a) => a.userId === actor.id),
  );
  const [sources, setSources] = useState<FormDataSources>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState("documents");
  const [edit, setEdit] = useState<{
    title: string;
    mode: EditorMode;
    endpoint: string;
    initial?: Record<string, unknown>;
  } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const detail = await api<JobDetail>(`jobs/${id}`);
      setJob(detail);
      if (can(actor, "jobsWrite"))
        setSources(await api<FormDataSources>("data/jobs"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Job gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, [id, actor]);
  useEffect(() => {
    let active = true;
    api<JobDetail>(`jobs/${id}`)
      .then((detail) => {
        if (active) setJob(detail);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Job gagal dimuat.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    if (can(actor, "jobsWrite"))
      api<FormDataSources>("data/jobs")
        .then((result) => {
          if (active) setSources(result);
        })
        .catch((e) => {
          if (active)
            setError(
              e instanceof Error ? e.message : "Data penugasan gagal dimuat.",
            );
        });
    return () => {
      active = false;
    };
  }, [id, actor]);
  const open = (
    title: string,
    mode: EditorMode,
    endpoint: string,
    initial?: Record<string, unknown>,
  ) => setEdit({ title, mode, endpoint, initial });
  async function download(docId: string, filename: string) {
    try {
      const response = await fetch(`/api/documents/${docId}/download`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unduh gagal.");
    }
  }
  return (
    <>
      <Link href="/jobs" className="back-link">
        <ArrowLeftIcon size={16} />
        Kembali ke job order
      </Link>
      <Feedback error={error} success={success} />
      {!job ? (
        <div className="empty" role="status">
          {loading ? (
            <LoadingState text="Memuat detail pekerjaan…" />
          ) : (
            "Job tidak dapat dimuat. Periksa penugasan atau hubungi Operations."
          )}
        </div>
      ) : (
        <>
          <PageHeader
            title={job.number}
            context={`Job order · ${services[job.serviceType as keyof typeof services]}`}
            status={<Status value={job.status} />}
            description={`${job.customer.name} · ${job.description}`}
            actions={
              <>
                {" "}
                <Refresh loading={loading} onClick={() => void load()} />
                {can(actor, "jobsWrite") && job.status === "draft" && (
                  <Button
                    onClick={() =>
                      open("Ubah job order", "job", `jobs/${id}`, { ...job })
                    }
                  >
                    Ubah detail
                  </Button>
                )}
                {can(actor, "jobsWrite") &&
                  !["completed", "cancelled"].includes(job.status) && (
                    <Button
                      onClick={() =>
                        open(
                          "Penugasan petugas",
                          "assign",
                          `jobs/${id}/assign`,
                          {
                            assignees: job.assignees,
                          },
                        )
                      }
                    >
                      Atur penugasan
                    </Button>
                  )}
                {can(actor, "jobsProgress") &&
                  mayWork &&
                  transitions[job.status].length > 0 && (
                    <Button
                      variant="primary"
                      onClick={() => {
                        const options = Object.fromEntries(
                          transitions[job.status]
                            .filter(
                              (s) =>
                                can(actor, "jobsWrite") ||
                                ["in_progress", "completed"].includes(s),
                            )
                            .map((s) => [s, statuses[s]]),
                        );
                        open(
                          "Perbarui status pekerjaan",
                          "status",
                          `jobs/${id}/status`,
                          {
                            status: Object.keys(options)[0],
                            statusOptions: options,
                          },
                        );
                      }}
                    >
                      Perbarui status
                    </Button>
                  )}
              </>
            }
          />
          <LayerCard className="job-overview">
            <RecordFacts
              items={[
                {
                  label: "Rute pekerjaan",
                  value: `${job.origin} → ${job.destination}`,
                },
                { label: "PIC Operations", value: job.picName },
                {
                  label: "Petugas lapangan",
                  value:
                    job.assignees.map((a) => a.name).join(", ") ||
                    "Belum ditugaskan",
                },
                { label: "Tenggat", value: dateText(job.dueAt, true) },
                {
                  label: "Kontak customer",
                  value: `${job.customer.contactName} · ${job.customer.phone}`,
                },
              ]}
            />
          </LayerCard>
          <div className="workflow-track">
            {[
              ["assigned", "Penugasan"],
              ["in_progress", "Pelaksanaan"],
              ["completed", "Penyelesaian"],
            ].map(([value, label]) => (
              <div
                key={value}
                className={
                  ["assigned", "in_progress", "completed"].indexOf(
                    job.status,
                  ) >= ["assigned", "in_progress", "completed"].indexOf(value)
                    ? "done"
                    : ""
                }
              >
                <CheckCircleIcon size={18} />
                {label}
              </div>
            ))}
            <div
              className={
                (checklists[job.serviceType] ?? []).every(
                  (type) =>
                    job.documents
                      .filter((d) => d.type === type)
                      .sort((a, b) => b.version - a.version)[0]?.status ===
                    "verified",
                )
                  ? "done"
                  : ""
              }
            >
              <CheckCircleIcon size={18} />
              Bukti terverifikasi
            </div>
          </div>
          <Tabs
            className="job-tabs"
            labels={{
              scrollStart: "Tab sebelumnya",
              scrollEnd: "Tab berikutnya",
            }}
            value={tab}
            onValueChange={setTab}
            tabs={Object.entries({
              documents: "Dokumen & verifikasi",
              delivery: "Surat jalan digital",
              progress: "Progres pekerjaan",
              ...(can(actor, "billingRead")
                ? { billing: "Kelayakan tagihan" }
                : {}),
            }).map(([value, label]) => {
              const Icon = {
                documents: FileTextIcon,
                delivery: ClipboardTextIcon,
                progress: PathIcon,
                billing: CurrencyCircleDollarIcon,
              }[value]!;
              return {
                value,
                label: (
                  <span className="nav-tab-label">
                    <Icon size={16} />
                    {label}
                  </span>
                ),
              };
            })}
          />
          <section
            role="tabpanel"
            id={`panel-${tab}`}
            aria-label={
              {
                documents: "Dokumen & verifikasi",
                delivery: "Surat jalan digital",
                progress: "Progres pekerjaan",
                billing: "Kelayakan tagihan",
              }[tab]
            }
          >
            {tab === "documents" && (
              <>
                <SectionPanel
                  title="Bukti pekerjaan"
                  description="Checklist layanan dan versi dokumen terbaru menentukan kesiapan penagihan."
                  action={
                    can(actor, "documentsUpload") &&
                    mayWork &&
                    job.status !== "cancelled" && (
                      <Button
                        variant="primary"
                        icon={<UploadSimpleIcon size={16} />}
                        onClick={() =>
                          open(
                            "Unggah bukti pekerjaan",
                            "upload",
                            `jobs/${id}/upload`,
                          )
                        }
                      >
                        Unggah dokumen
                      </Button>
                    )
                  }
                >
                  <div className="checklist-strip">
                    {(checklists[job.serviceType] ?? []).map((type) => {
                      const latest = job.documents
                        .filter((d) => d.type === type)
                        .sort((a, b) => b.version - a.version)[0];
                      return (
                        <div key={type}>
                          {latest?.status === "verified" ? (
                            <CheckCircleIcon
                              className="text-kumo-success"
                              size={17}
                            />
                          ) : (
                            <ClockIcon size={17} />
                          )}
                          <span>
                            {documentTypes[type as keyof typeof documentTypes]}
                          </span>
                          <Status value={latest?.status ?? "Belum diunggah"} />
                        </div>
                      );
                    })}
                  </div>
                  <DataTable
                    rows={job.documents}
                    empty="Unggah bukti sesuai checklist layanan. Bukti hanya dianggap sah setelah review Operations."
                    columns={[
                      {
                        title: "Dokumen",
                        render: (r) => (
                          <div>
                            <strong>{r.filename}</strong>
                            <p className="text-kumo-subtle">
                              {
                                documentTypes[
                                  r.type as keyof typeof documentTypes
                                ]
                              }{" "}
                              · versi {r.version}
                            </p>
                          </div>
                        ),
                      },
                      {
                        title: "Unggah",
                        render: (r) => dateText(r.createdAt, true),
                      },
                      {
                        title: "Review",
                        render: (r) => (
                          <div>
                            <Status value={r.status} />
                            <p className="text-kumo-subtle">
                              {r.reviewNote ?? "Menunggu pemeriksaan"}
                            </p>
                          </div>
                        ),
                      },
                      {
                        title: "",
                        render: (r) => (
                          <div className="row-actions">
                            <Button
                              size="sm"
                              icon={<DownloadSimpleIcon size={16} />}
                              onClick={() => void download(r.id, r.filename)}
                            >
                              Unduh
                            </Button>
                            {can(actor, "documentsReview") &&
                              r.status === "submitted" &&
                              !job.documents.some(
                                (n) =>
                                  n.type === r.type && n.version > r.version,
                              ) && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    open(
                                      "Review bukti pekerjaan",
                                      "review",
                                      `documents/${r.id}/review`,
                                      { status: "verified" },
                                    )
                                  }
                                >
                                  Review
                                </Button>
                              )}
                          </div>
                        ),
                      },
                    ]}
                  />
                </SectionPanel>
              </>
            )}
            {tab === "delivery" && (
              <>
                <SectionPanel
                  title="Surat jalan digital"
                  description="Formulir serah terima. Unggah bukti bertanda tangan pada tab dokumen untuk verifikasi."
                  action={
                    can(actor, "documentsUpload") &&
                    mayWork &&
                    job.status !== "cancelled" && (
                      <Button
                        variant="primary"
                        icon={<PlusIcon size={16} />}
                        onClick={() =>
                          open(
                            "Catat surat jalan digital",
                            "delivery",
                            `jobs/${id}/delivery`,
                          )
                        }
                      >
                        Buat surat jalan
                      </Button>
                    )
                  }
                >
                  <DataTable
                    rows={job.deliveries}
                    columns={[
                      {
                        title: "Penerima / kendaraan",
                        render: (r) => (
                          <div>
                            <strong>{r.recipient}</strong>
                            <p className="text-kumo-subtle">{r.vehicle}</p>
                          </div>
                        ),
                      },
                      {
                        title: "Barang",
                        render: (r) => `${r.cargo} · ${r.quantity} unit`,
                      },
                      {
                        title: "Serah terima",
                        render: (r) => dateText(r.deliveredAt, true),
                      },
                      { title: "Catatan", render: (r) => r.note || "—" },
                      {
                        title: "",
                        render: (r) => (
                          <Link
                            className="record-link"
                            href={`/jobs/${id}/delivery/${r.id}`}
                            target="_blank"
                          >
                            Cetak / PDF
                          </Link>
                        ),
                      },
                    ]}
                  />
                </SectionPanel>
              </>
            )}
            {tab === "progress" && (
              <>
                <SectionPanel
                  title="Catatan pekerjaan"
                  description="Perubahan status dan laporan lapangan tersimpan dengan nama pelaku."
                  action={
                    can(actor, "jobsProgress") &&
                    mayWork &&
                    !["completed", "cancelled"].includes(job.status) && (
                      <Button
                        variant="primary"
                        icon={<PlusIcon size={16} />}
                        onClick={() =>
                          open(
                            "Catat progres",
                            "progress",
                            `jobs/${id}/progress`,
                          )
                        }
                      >
                        Tambah catatan
                      </Button>
                    )
                  }
                >
                  <DataTable
                    rows={job.progress}
                    columns={[
                      {
                        title: "Waktu",
                        render: (r) => dateText(r.createdAt, true),
                      },
                      { title: "Pelaku", render: (r) => r.name },
                      { title: "Catatan", render: (r) => r.note },
                    ]}
                  />
                </SectionPanel>
              </>
            )}
            {tab === "billing" && (
              <>
                <SectionPanel
                  title="Komponen tagihan pekerjaan"
                  description="Persetujuan tarif dan checklist bukti diperiksa kembali saat invoice diterbitkan."
                  action={
                    <Link className="record-link" href="/billing">
                      Kelola komponen →
                    </Link>
                  }
                >
                  <DataTable
                    rows={job.billables}
                    columns={[
                      { title: "Komponen", render: (r) => r.description },
                      {
                        title: "Nominal",
                        render: (r) =>
                          formatMoney(r.approvedAmount, r.currency),
                      },
                      {
                        title: "Saldo tersedia",
                        render: (r) => formatMoney(r.available, r.currency),
                      },
                      {
                        title: "Kelayakan",
                        render: (r) => r.blockers.join("; ") || "Siap ditagih",
                      },
                    ]}
                  />
                </SectionPanel>
              </>
            )}
          </section>
        </>
      )}
      <Modal
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={edit?.title ?? "Ubah pekerjaan"}
        description="Data divalidasi sesuai penugasan dan aturan workflow."
      >
        {edit && (
          <Editor
            key={`${edit.mode}-${edit.endpoint}`}
            mode={edit.mode}
            endpoint={edit.endpoint}
            initial={edit.initial}
            sources={sources}
            onCancel={() => setEdit(null)}
            onSaved={() => {
              setEdit(null);
              setSuccess("Perubahan pekerjaan berhasil disimpan.");
              void load();
            }}
          />
        )}
      </Modal>
    </>
  );
}

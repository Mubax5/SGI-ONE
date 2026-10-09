"use client";
import Image from "next/image";
import {
  Button,
  Combobox,
  Empty,
  Input,
  InputArea,
  LinkButton,
  Text,
} from "@cloudflare/kumo";
import {
  CameraIcon,
  PlusIcon,
  ArrowSquareOutIcon,
  XIcon,
} from "@phosphor-icons/react";
import { FormEvent, useEffect, useState } from "react";
import { Actor, can } from "@/lib/domain";
import type { reports } from "@/modules/reports";
import type { Serialized } from "./types";
import { api, dateText, Feedback, Modal, SectionPanel } from "./shared";
import { LoadingState, PageHeader } from "./workspace-ui";
type ReportData = Serialized<Awaited<ReturnType<typeof reports>>>;
export function ReportsPage({
  actor,
  createOnLoad = false,
  initialSearch = "",
  initialJob = "",
}: {
  actor: Actor;
  createOnLoad?: boolean;
  initialSearch?: string;
  initialJob?: string;
}) {
  const [data, setData] = useState<ReportData>();
  const [search, setSearch] = useState(initialSearch);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(createOnLoad && can(actor, "jobsProgress"));
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState(initialJob);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File>();
  const [preview, setPreview] = useState("");
  const [fileReset, setFileReset] = useState(0);
  const [photoReport, setPhotoReport] = useState<ReportData["rows"][number]>();
  const [photoError, setPhotoError] = useState(false);
  useEffect(() => {
    let active = true;
    api<ReportData>("data/reports")
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const jobs = (data?.jobs ?? []).filter(
    (j) => !["completed", "cancelled"].includes(j.status),
  );
  const labels = jobs.map((j) => `${j.number} · ${j.customerName}`);
  function choosePhoto(file?: File) {
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : "");
    if (!file) setFileReset((value) => value + 1);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!jobs.some((j) => j.id === jobId)) {
      setError("Pilih pekerjaan aktif yang tersedia untuk Anda.");
      return;
    }
    if (
      photo &&
      (photo.size > 10485760 ||
        !["image/jpeg", "image/png", "image/webp"].includes(photo.type))
    ) {
      setError("Pilih foto JPG, PNG, atau WebP, maksimal 10 MB.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("note", note);
      if (photo) form.set("photo", photo);
      await api(`jobs/${jobId}/report`, form);
      setOpen(false);
      setNote("");
      choosePhoto(undefined);
      setSuccess("Laporan tersimpan dan tercatat pada progres pekerjaan.");
      try {
        setData(await api<ReportData>("data/reports"));
      } catch {
        setError(
          "Laporan sudah tersimpan, tetapi daftar belum dapat diperbarui. Muat ulang halaman; tidak perlu mengirim ulang laporan.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Laporan gagal disimpan. Coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }
  const rows = (data?.rows ?? []).filter((row) =>
    `${row.jobNumber} ${row.customerName} ${row.actorName} ${row.note}`
      .toLocaleLowerCase("id")
      .includes(search.toLocaleLowerCase("id")),
  );
  return (
    <>
      <PageHeader
        title="Laporan pekerjaan"
        context="Aktivitas lapangan"
        description="Catatan dan foto privat, terhubung langsung ke progres job."
        actions={
          can(actor, "jobsProgress") && (
            <Button
              variant="primary"
              icon={<PlusIcon size={18} />}
              onClick={() => {
                setError("");
                setOpen(true);
              }}
            >
              Buat laporan
            </Button>
          )
        }
      />
      {!open && <Feedback error={error} success={success} />}
      <Input
        className="report-list-search"
        aria-label="Cari laporan"
        placeholder="Cari job, petugas, atau catatan…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {!data ? (
        error ? (
          <Button onClick={() => window.location.reload()}>
            Muat ulang laporan
          </Button>
        ) : (
          <LoadingState text="Memuat laporan yang dapat Anda akses…" />
        )
      ) : !rows.length ? (
        <Empty
          title="Belum ada laporan yang sesuai"
          description={
            can(actor, "jobsProgress")
              ? "Pilih Buat laporan untuk mencatat pekerjaan dan menambahkan foto."
              : "Laporan muncul setelah petugas mencatat pekerjaan."
          }
        />
      ) : (
        <div className="report-list">
          {rows.map((row) => (
            <SectionPanel
              key={row.id}
              title={row.jobNumber}
              description={`${row.customerName} · ${row.actorName} · ${dateText(row.createdAt, true)}`}
              action={
                <LinkButton
                  variant="ghost"
                  href={`/jobs/${row.jobId}`}
                  icon={<ArrowSquareOutIcon size={16} />}
                >
                  Buka job
                </LinkButton>
              }
            >
              <div className="report-entry">
                <Text DANGEROUS_className="report-note">{row.note}</Text>
                {row.hasPhoto && (
                  <Button
                    variant="outline"
                    icon={<CameraIcon size={18} />}
                    onClick={() => {
                      setPhotoReport(row);
                      setPhotoError(false);
                    }}
                  >
                    Lihat foto · {row.filename}
                  </Button>
                )}
              </div>
            </SectionPanel>
          ))}
        </div>
      )}
      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Buat laporan pekerjaan"
        description="Pilih job, jelaskan pekerjaan, dan tambahkan foto bila diperlukan."
      >
        <form className="report-editor" onSubmit={submit}>
          <Feedback error={error} />
          {!data ? (
            <LoadingState />
          ) : !jobs.length ? (
            <Empty
              title="Tidak ada pekerjaan aktif"
              description="Hubungi Operations untuk penugasan baru sebelum membuat laporan."
            />
          ) : (
            <>
              <Combobox
                items={labels}
                value={labels[jobs.findIndex((j) => j.id === jobId)] ?? null}
                onValueChange={(value) =>
                  setJobId(jobs[labels.indexOf(value as string)]?.id ?? "")
                }
                label="Pekerjaan"
                required
              >
                <Combobox.TriggerValue
                  className="report-job-select"
                  placeholder="Pilih job aktif"
                />
                <Combobox.Content>
                  <Combobox.Input placeholder="Cari nomor job atau customer…" />
                  <Combobox.Empty>Tidak ada job yang sesuai.</Combobox.Empty>
                  <Combobox.List>
                    {(item: string) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Content>
              </Combobox>
              <InputArea
                label="Catatan pekerjaan"
                value={note}
                onValueChange={setNote}
                rows={4}
                required
                minLength={5}
                maxLength={2000}
                description="Jelaskan pekerjaan yang selesai, kendala, dan tindak lanjut."
              />
              <Input
                label="Foto laporan"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                description="JPG, PNG, atau WebP; maksimal 10 MB. Foto disimpan privat."
                onChange={(e) => choosePhoto(e.target.files?.[0])}
                key={fileReset}
              />
              {preview && (
                <div className="report-preview">
                  <Image
                    src={preview}
                    alt="Pratinjau foto yang akan dilampirkan"
                    width={600}
                    height={400}
                    unoptimized
                  />
                  <Button
                    variant="ghost"
                    icon={<XIcon size={16} />}
                    onClick={() => choosePhoto(undefined)}
                  >
                    Hapus pilihan foto
                  </Button>
                </div>
              )}
            </>
          )}
          <div className="form-actions">
            <Button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              icon={<CameraIcon size={18} />}
              loading={busy}
              disabled={!jobs.length || !data}
            >
              Kirim laporan
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(photoReport)}
        onClose={() => setPhotoReport(undefined)}
        title="Foto laporan"
        description={
          photoReport
            ? `${photoReport.jobNumber} · ${photoReport.actorName}`
            : "Lampiran privat pekerjaan"
        }
      >
        <div className="report-photo-body">
          {photoReport &&
            (photoError ? (
              <Feedback error="Foto tidak dapat dimuat. Tutup dan buka kembali; hubungi Operations jika masih gagal." />
            ) : (
              <Image
                src={`/api/reports/${photoReport.id}/photo`}
                alt={`Foto pekerjaan ${photoReport.jobNumber}`}
                width={1000}
                height={750}
                unoptimized
                onError={() => setPhotoError(true)}
              />
            ))}
        </div>
      </Modal>
    </>
  );
}

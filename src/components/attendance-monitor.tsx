"use client";
import { Badge, Button, Input, InputArea, Text } from "@cloudflare/kumo";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { Actor } from "@/lib/domain";
import type { attendanceMonitoring } from "@/modules/attendance";
import type { Serialized } from "./types";
import { api, Modal, DataTable, dateText, Feedback } from "./shared";
import { FilterButtons } from "./filter-buttons";
import { FilterPopover } from "./filter-popover";
import { LoadingState } from "./workspace-ui";
import { useLiveRevision } from "@/lib/live-data";
type Data = Serialized<Awaited<ReturnType<typeof attendanceMonitoring>>>;
const modes: Record<string, string> = {
  onsite: "Kantor / job",
  wfh: "WFH",
  visit: "Lapangan",
};
const states: Record<string, string> = {
  unreviewed: "Belum diperiksa",
  validated: "Lokasi cocok",
  pending: "Perlu review",
  approved: "Disetujui",
  rejected: "Ditolak",
};
export function AttendanceMonitor({ actor }: { actor: Actor }) {
  const liveRevision = useLiveRevision();
  const [open, setOpen] = useState(false),
    [data, setData] = useState<Data>(),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [mode, setMode] = useState("all"),
    [status, setStatus] = useState("all"),
    [search, setSearch] = useState("");
  const [record, setRecord] = useState<Data["rows"][number] | null>(null),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  useEffect(() => {
    if (!open) return;
    let alive = true;
    api<Data>("attendance/monitoring")
      .then((r) => {
        if (alive) {
          setData(r);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [open, revision, liveRevision]);
  async function review(decision: "approved" | "rejected") {
    if (!record) return;
    setBusy(true);
    setError("");
    try {
      await api(`attendance/${record.id}/review`, { status: decision, note });
      setRecord(null);
      setNote("");
      setRevision((v) => v + 1);
      setSuccess("Review tersimpan.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Review gagal disimpan. Coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }
  const rows =
    data?.rows.filter(
      (r) =>
        (mode === "all" || r.workMode === mode) &&
        (status === "all" || r.reviewStatus === status) &&
        r.name.toLocaleLowerCase("id").includes(search.toLocaleLowerCase("id")),
    ) ?? [];
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Pemantauan absensi
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setRecord(null);
        }}
        title="Pemantauan absensi"
      >
        <div className="detail-body attendance-monitor-body">
          <Feedback error={!record ? error : ""} success={success} />
          <Input
            label="Cari karyawan"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <FilterPopover
            active={mode !== "all" || status !== "all"}
            label="Filter pemantauan absensi"
            align="start"
          >
            <FilterButtons
              label="Mode kerja"
              value={mode}
              items={{ all: "Semua", ...modes }}
              onChange={setMode}
            />
            <FilterButtons
              label="Review"
              value={status}
              items={{
                all: "Semua",
                pending: "Perlu review",
                approved: "Disetujui",
                rejected: "Ditolak",
              }}
              onChange={setStatus}
            />
          </FilterPopover>
          {!data ? (
            <LoadingState />
          ) : (
            <DataTable
              rows={rows}
              empty="Ubah filter untuk melihat absensi lainnya."
              columns={[
                {
                  title: "Karyawan",
                  mobile: "title",
                  render: (r) => (
                    <>
                      <strong>{r.name}</strong>
                      <p>{dateText(r.checkIn, true)}</p>
                    </>
                  ),
                },
                {
                  title: "Mode kerja",
                  mobile: "primary",
                  render: (r) => modes[r.workMode] || r.workMode,
                },
                {
                  title: "Review",
                  mobile: "status",
                  render: (r) => (
                    <Badge
                      variant={
                        r.reviewStatus === "rejected"
                          ? "error"
                          : r.reviewStatus === "pending"
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {states[r.reviewStatus]}
                    </Badge>
                  ),
                },
                { title: "Check-in", render: (r) => dateText(r.checkIn, true) },
                {
                  title: "Check-out",
                  render: (r) =>
                    r.checkOut ? dateText(r.checkOut, true) : "Belum check-out",
                },
                {
                  title: "Rencana / hasil kerja",
                  mobile: "details",
                  render: (r) => r.note || "—",
                },
                {
                  title: "Catatan review",
                  mobile: "details",
                  render: (r) => r.reviewNote || "—",
                },
                {
                  title: "",
                  render: (r) => (
                    <Button
                      onClick={() => {
                        setRecord(r);
                        setNote("");
                      }}
                    >
                      Lihat bukti
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </div>
      </Modal>
      <Modal
        open={!!record}
        onClose={() => setRecord(null)}
        title="Bukti dan review absensi"
        description={record?.name}
      >
        {record && (
          <div className="detail-body attendance-monitor-body">
            <Feedback error={error} />
            <Text>
              {modes[record.workMode]} · {dateText(record.checkIn, true)}
            </Text>
            <Text>{record.note || "Tidak ada catatan kerja."}</Text>
            {record.evidence.length === 0 && (
              <Text>Belum ada bukti foto atau lokasi.</Text>
            )}
            {record.evidence.map((e) => (
              <section key={e.id}>
                <Text as="h3">
                  {e.kind === "in" ? "Check-in" : "Check-out"} ·{" "}
                  {e.target.label}
                </Text>
                <Image
                  src={`/api/attendance/${e.id}/photo`}
                  width={640}
                  height={480}
                  alt={`Foto ${e.kind === "in" ? "check-in" : "check-out"}`}
                  className="attendance-photo"
                  unoptimized
                />
                <Text variant="secondary">
                  GPS {e.lat.toFixed(5)}, {e.lng.toFixed(5)} · akurasi ±
                  {Math.round(e.accuracy)} m
                </Text>
              </section>
            ))}
            {record.reviewStatus === "pending" &&
              record.userId !== actor.id && (
                <>
                  <InputArea
                    label="Catatan review"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    required
                    minLength={5}
                  />
                  <div className="form-actions">
                    <Button
                      variant="secondary-destructive"
                      disabled={busy || note.trim().length < 5}
                      onClick={() => void review("rejected")}
                    >
                      Tolak
                    </Button>
                    <Button
                      variant="primary"
                      disabled={busy || note.trim().length < 5}
                      onClick={() => void review("approved")}
                    >
                      Setujui
                    </Button>
                  </div>
                </>
              )}
          </div>
        )}
      </Modal>
    </>
  );
}

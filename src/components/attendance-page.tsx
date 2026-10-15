"use client";
import Image from "next/image";
import {
  Badge,
  Button,
  InputArea,
  LinkButton,
  Select,
  Text,
} from "@cloudflare/kumo";
import {
  CameraIcon,
  CrosshairIcon,
  EyeIcon,
  MapPinIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Actor, can } from "@/lib/domain";
import { useDeviceLocation } from "@/lib/device-location";
import { useLiveRevision } from "@/lib/live-data";
import {
  checkAttendanceFix,
  checkAttendanceSample,
  ATTENDANCE_POLICY,
  distanceBetween,
  type AttendanceTarget,
} from "@/lib/attendance-policy";
import { mapSearchLink } from "@/lib/map-links";
import type { attendanceHistory } from "@/modules/attendance";
import type { Serialized } from "./types";
import {
  api,
  DataTable,
  dateText,
  Feedback,
  Modal,
  SectionPanel,
} from "./shared";
import { LoadingState, PageHeader } from "./workspace-ui";
import { CameraCapture, type CameraPhoto } from "./camera-capture";
import { FilterButtons } from "./filter-buttons";
import { FilterPopover } from "./filter-popover";
import { AttendanceMonitor } from "./attendance-monitor";
type Data = Serialized<Awaited<ReturnType<typeof attendanceHistory>>>;
function AttendanceForm({
  kind,
  targets,
  onSaved,
  onCancel,
  initialMode = "onsite",
  isField = false,
}: {
  isField?: boolean;
  initialMode?: "onsite" | "wfh" | "visit";
  kind: "in" | "out";
  targets: AttendanceTarget[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const gps = useDeviceLocation();
  const [targetKey, setTargetKey] = useState(""),
    [photo, setPhoto] = useState<File>(),
    [preview, setPreview] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [workMode, setWorkMode] = useState(initialMode);
  const [capture, setCapture] = useState<CameraPhoto>();
  const availableTargets =
    workMode === "visit" && isField
      ? targets.filter((t) => t.key.startsWith("job:"))
      : targets;
  const nearest = gps.position
    ? [...availableTargets].sort(
        (a, b) =>
          distanceBetween(gps.position!, a) - distanceBetween(gps.position!, b),
      )[0]?.key
    : "";
  const selectedKey = targetKey || nearest || "";
  const target: AttendanceTarget | undefined =
    workMode === "onsite"
      ? targets.find((t) => t.key === selectedKey)
      : gps.position
        ? {
            key:
              workMode === "wfh" ? "wfh:home" : selectedKey || "visit:mobile",
            label: workMode === "wfh" ? "WFH" : "Kunjungan lapangan",
            ...gps.position,
            radius: 200,
          }
        : undefined;
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  let validation = "",
    distance: number | undefined;
  if (target && gps.position) {
    try {
      if (workMode === "onsite")
        distance = checkAttendanceFix(gps.position, target);
      else
        checkAttendanceSample(
          gps.position,
          ATTENDANCE_POLICY.maximumRemoteAccuracy,
        );
    } catch (e) {
      validation = e instanceof Error ? e.message : "Lokasi belum valid.";
    }
  }
  const ready =
    !!target &&
    !!gps.position &&
    !gps.stale &&
    !validation &&
    !!photo &&
    !!capture;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!ready || !target || !gps.position || !photo) {
      setError("Aktifkan GPS dan ambil foto diri.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set(
        "data",
        JSON.stringify({
          kind,
          targetKey: target.key,
          ...gps.position,
          note,
          workMode,
          cameraToken: capture!.cameraToken,
          capturedAt: capture!.capturedAt,
        }),
      );
      form.set("photo", photo);
      await api("attendance", form);
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Absensi belum tersimpan. Coba kembali.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="attendance-form-body">
        <Feedback error={error || gps.error} />
        {kind === "in" && (
          <FilterButtons
            label="Mode kerja"
            value={workMode}
            items={{
              onsite: "Kantor / job",
              wfh: "WFH",
              visit: "Lapangan",
            }}
            onChange={(v) => setWorkMode(v as typeof workMode)}
          />
        )}
        <div className="attendance-location-heading">
          <Text as="strong">Lokasi kerja</Text>
          <Button
            type="button"
            variant="outline"
            icon={<CrosshairIcon size={18} />}
            onClick={() => {
              gps.stop();
              gps.start();
            }}
            disabled={busy}
          >
            {gps.tracking ? "Ambil ulang GPS" : "Aktifkan GPS"}
          </Button>
        </div>
        {workMode !== "wfh" && (
          <Select
            label="Lokasi absensi"
            value={selectedKey}
            items={Object.fromEntries(
              availableTargets.map((t) => [t.key, t.label]),
            )}
            onValueChange={(v) => setTargetKey(v ?? "")}
            placeholder="Pilih lokasi kerja"
            disabled={!targets.length || busy}
          />
        )}
        {workMode === "onsite" && !availableTargets.length && (
          <Feedback error="Lokasi belum tersedia. Hubungi administrator atau Operations." />
        )}
        <div className="attendance-validation" role="status">
          <Badge
            variant={
              gps.position && !validation && target && !gps.stale
                ? workMode === "onsite"
                  ? "success"
                  : "warning"
                : "secondary"
            }
          >
            {gps.position && !validation && target && !gps.stale
              ? workMode === "onsite"
                ? "Lokasi cocok"
                : "Perlu review"
              : "Lokasi belum valid"}
          </Badge>
          <Text variant="secondary">
            {!gps.position
              ? "Izinkan GPS untuk memeriksa posisi Anda."
              : gps.stale
                ? "Posisi GPS sudah usang. Ambil ulang GPS."
                : validation ||
                  (workMode === "onsite"
                    ? `Jarak ${Math.round(distance ?? 0)} m · akurasi ±${Math.round(gps.position.accuracy)} m · radius ${target?.radius} m`
                    : `Akurasi GPS ±${Math.round(gps.position.accuracy)} m`)}
          </Text>
          {target && (
            <LinkButton
              variant="ghost"
              href={
                workMode === "onsite" && target.placeLabel
                  ? mapSearchLink({ ...target, label: target.placeLabel })
                  : mapSearchLink(target)
              }
              target="_blank"
              rel="noopener noreferrer"
              icon={<MapPinIcon size={16} />}
            >
              Lihat lokasi kerja
            </LinkButton>
          )}
          {workMode === "onsite" && target && (
            <LinkButton
              variant="ghost"
              href={mapSearchLink(target)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Titik lokasi
            </LinkButton>
          )}
        </div>
        <CameraCapture
          disabled={busy}
          onCapture={(value) => {
            setCapture(value);
            setPhoto(value.file);
            setPreview(URL.createObjectURL(value.file));
            setError("");
          }}
        />
        <Text variant="secondary">Ambil foto diri saat absen.</Text>
        {preview && (
          <Image
            className="attendance-photo"
            src={preview}
            width={640}
            height={480}
            alt="Pratinjau foto absensi"
            unoptimized
          />
        )}
        <InputArea
          label={
            workMode === "onsite"
              ? "Catatan absensi"
              : kind === "in"
                ? "Rencana kerja"
                : "Hasil kerja"
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          required={workMode !== "onsite"}
          minLength={workMode !== "onsite" ? 10 : undefined}
          disabled={busy}
        />
      </div>
      <div className="form-actions">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          Batal
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={busy}
          disabled={!ready}
        >
          {kind === "in" ? "Check-in" : "Check-out"}
        </Button>
      </div>
    </form>
  );
}
export function AttendancePage({ actor }: { actor: Actor }) {
  const [historyAsOf, setHistoryAsOf] = useState(0);
  const [historyMode, setHistoryMode] = useState("all"),
    [historyAge, setHistoryAge] = useState("all");
  const revision = useLiveRevision();
  const [data, setData] = useState<Data>(),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [open, setOpen] = useState(false),
    [proof, setProof] = useState<Data["rows"][number]>();
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    api<Data>("data/attendance")
      .then((r) => {
        if (alive) {
          setData(r);
          setHistoryAsOf(Date.now());
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [revision, refresh]);
  const current = data?.rows.find((r) => !r.checkOut);
  const saved = () => {
    setOpen(false);
    setRefresh((v) => v + 1);
    setSuccess("Perubahan tersimpan.");
  };
  return (
    <>
      <PageHeader
        title="Absensi saya"
        actions={
          can(actor, "attendanceMonitor") ? (
            <AttendanceMonitor actor={actor} />
          ) : undefined
        }
      />
      <Feedback error={error} success={success} />
      {!data ? (
        <LoadingState text="Memuat riwayat dan lokasi absensi…" />
      ) : (
        <>
          <SectionPanel
            title={current ? "Anda sedang check-in" : "Mulai hari kerja"}
            description={
              current
                ? `Check-in ${dateText(current.checkIn, true)}`
                : undefined
            }
            action={
              <Button
                variant="primary"
                icon={<CameraIcon size={18} />}
                onClick={() => {
                  setSuccess("");
                  setOpen(true);
                }}
              >
                {current ? "Check-out" : "Check-in"}
              </Button>
            }
          >
            <div className="attendance-policy-summary">
              <Text>GPS dan foto wajib untuk check-in dan check-out.</Text>
            </div>
          </SectionPanel>
          <SectionPanel title="Riwayat kehadiran">
            <div className="attendance-history-filters">
              <FilterPopover
                active={historyMode !== "all" || historyAge !== "all"}
                label="Filter riwayat kehadiran"
                align="start"
              >
                <FilterButtons
                  label="Mode kerja"
                  value={historyMode}
                  items={{
                    all: "Semua",
                    onsite: "Kantor / job",
                    wfh: "WFH",
                    visit: "Lapangan",
                  }}
                  onChange={setHistoryMode}
                />
                <FilterButtons
                  label="Tanggal"
                  value={historyAge}
                  items={{
                    all: "Semua tanggal",
                    "7": "7 hari terakhir",
                    "30": "30 hari terakhir",
                  }}
                  onChange={setHistoryAge}
                />
              </FilterPopover>
            </div>
            <DataTable
              rows={data.rows.filter(
                (r) =>
                  (historyMode === "all" || r.workMode === historyMode) &&
                  (historyAge === "all" ||
                    historyAsOf - new Date(r.checkIn).getTime() <=
                      Number(historyAge) * 86400000),
              )}
              columns={[
                {
                  title: "Check-in",
                  mobile: "title",
                  render: (r) => dateText(r.checkIn, true),
                },
                {
                  title: "Check-out",
                  mobile: "primary",
                  render: (r) =>
                    r.checkOut ? dateText(r.checkOut, true) : "Belum check-out",
                },
                {
                  title: "Lokasi",
                  mobile: "primary",
                  render: (r) =>
                    r.evidence[0]?.target.label ?? "Belum ada bukti lokasi",
                },
                {
                  title: "Mode kerja",
                  mobile: "details",
                  render: (r) =>
                    ({ onsite: "Kantor / job", wfh: "WFH", visit: "Lapangan" })[
                      r.workMode as "onsite" | "wfh" | "visit"
                    ] || r.workMode,
                },
                {
                  title: "Review",
                  mobile: "status",
                  render: (r) => (
                    <Badge
                      variant={
                        r.reviewStatus === "pending"
                          ? "warning"
                          : r.reviewStatus === "rejected"
                            ? "error"
                            : "secondary"
                      }
                    >
                      {
                        (
                          {
                            unreviewed: "Belum diperiksa",
                            validated: "Lokasi cocok",
                            pending: "Perlu review",
                            approved: "Disetujui",
                            rejected: "Ditolak",
                          } as Record<string, string>
                        )[r.reviewStatus]
                      }
                    </Badge>
                  ),
                },
                {
                  title: "Bukti",
                  mobile: "details",
                  render: (r) => (
                    <Badge
                      variant={
                        r.evidence.length
                          ? r.checkOut && r.evidence.length < 2
                            ? "warning"
                            : "success"
                          : "secondary"
                      }
                    >
                      {r.evidence.length
                        ? `${r.evidence.length} bukti`
                        : "Tanpa bukti"}
                    </Badge>
                  ),
                },
                {
                  title: "Catatan",
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
                  render: (r) =>
                    r.evidence.length ? (
                      <Button
                        variant="ghost"
                        shape="square"
                        icon={<EyeIcon size={18} />}
                        aria-label="Bukti absensi"
                        onClick={() => setProof(r)}
                      />
                    ) : null,
                },
              ]}
            />
          </SectionPanel>
        </>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={current ? "Check-out" : "Check-in"}
      >
        {open && data && (
          <AttendanceForm
            kind={current ? "out" : "in"}
            initialMode={
              (current?.workMode as "onsite" | "wfh" | "visit") ?? "onsite"
            }
            isField={actor.roles.includes("field")}
            targets={data.targets}
            onCancel={() => setOpen(false)}
            onSaved={saved}
          />
        )}
      </Modal>
      <Modal
        open={!!proof}
        onClose={() => setProof(undefined)}
        title="Bukti absensi"
      >
        <div className="detail-body attendance-evidence-list">
          {proof?.evidence.map((e) => (
            <section key={e.id}>
              <Text as="h3">
                {e.kind === "in" ? "Check-in" : "Check-out"} ·{" "}
                {dateText(
                  e.kind === "in" ? proof.checkIn : proof.checkOut,
                  true,
                )}
              </Text>
              <Text>{e.target.label}</Text>
              <Text variant="secondary">
                Jarak {Math.round(e.distance)} m · akurasi ±
                {Math.round(e.accuracy)} m
              </Text>
              <Image
                src={`/api/attendance/${e.id}/photo`}
                width={640}
                height={480}
                className="attendance-photo"
                alt={`Foto ${e.kind === "in" ? "check-in" : "check-out"}`}
                unoptimized
              />
              <LinkButton
                variant="ghost"
                href={mapSearchLink(e)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Lokasi saat absen
              </LinkButton>
            </section>
          ))}
        </div>
      </Modal>
    </>
  );
}

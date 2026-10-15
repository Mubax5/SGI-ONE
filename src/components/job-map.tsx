"use client";
import { ToolbarAction, ToolbarLink } from "./toolbar-action";
import {
  Badge,
  Button,
  Collapsible,
  Input,
  LinkButton,
  Select,
  Text,
} from "@cloudflare/kumo";
import {
  ArrowSquareOutIcon,
  ArrowClockwiseIcon,
  CrosshairIcon,
  MapPinIcon,
  NavigationArrowIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapData } from "@/modules/maps";
import type { RoadRoute } from "@/lib/road-routing";
import { useDeviceLocation, type DevicePosition } from "@/lib/device-location";
import { workspaceHeaders } from "@/lib/live-data";
import { Actor, can } from "@/lib/domain";
import { api, Feedback, SectionPanel, Status } from "./shared";
import { useLiveRevision } from "@/lib/live-data";
import { LoadingState } from "./workspace-ui";
import type { Serialized } from "./types";
type Row = Serialized<MapData>["rows"][number];

import { MapCanvas } from "./job-map-canvas";
import { JobLocationDialog } from "./job-location-dialog";
import { mapDirectionsLink, type MapPoint } from "@/lib/map-links";
type VisibleRoute = RoadRoute & { jobId: string };
function maneuverText(step: RoadRoute["steps"][number]) {
  const directions: Record<string, string> = {
    left: "kiri",
    right: "kanan",
    "slight left": "sedikit ke kiri",
    "slight right": "sedikit ke kanan",
    "sharp left": "tajam ke kiri",
    "sharp right": "tajam ke kanan",
    straight: "lurus",
    uturn: "putar balik",
  };
  const direction = step.modifier
    ? directions[step.modifier] || "lurus"
    : "lurus";
  if (step.type === "depart") return "Mulai perjalanan";
  if (step.type === "arrive") return "Tiba di tujuan";
  if (["roundabout", "rotary", "roundabout turn"].includes(step.type))
    return `Di bundaran, ${step.exit ? `ambil keluar ke-${step.exit}` : `lanjut ${direction}`}`;
  if (step.type === "merge") return `Bergabung ${direction}`;
  if (step.type === "on ramp") return `Masuk jalur ${direction}`;
  if (step.type === "off ramp") return `Keluar jalur ${direction}`;
  if (step.type === "fork") return `Ambil cabang ${direction}`;
  if (direction === "putar balik") return "Putar balik";
  return direction === "lurus" ? "Lanjut lurus" : `Belok ${direction}`;
}
const distanceText = (meters: number) =>
  meters >= 1000
    ? `${(meters / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`
    : `${Math.round(meters)} m`;
export function JobMap({
  actor,
  embedded = false,
  jobIds,
}: {
  actor?: Actor;
  embedded?: boolean;
  jobIds?: string[];
}) {
  const liveRevision = useLiveRevision();
  const [data, setData] = useState<Serialized<MapData>>();
  const [selected, setSelected] = useState("all");
  const [jobQuery, setJobQuery] = useState(""),
    [searchQuery, setSearchQuery] = useState(""),
    [showAllJobs, setShowAllJobs] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(jobQuery), 300);
    return () => clearTimeout(timer);
  }, [jobQuery]);
  const [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<Row | null>(null),
    [busy, setBusy] = useState(false);
  const [points, setPoints] = useState<{
    origin?: MapPoint;
    destination?: MapPoint;
  }>({});
  const [endpoint, setEndpoint] = useState("origin");
  const gps = useDeviceLocation();
  const [fromGPS, setFromGPS] = useState(false);
  const [route, setRoute] = useState<VisibleRoute>();
  const [routeError, setRouteError] = useState(""),
    [routing, setRouting] = useState(false),
    [routeRevision, setRouteRevision] = useState(0);
  const [gpsOrigin, setGpsOrigin] = useState<DevicePosition>();
  const lastGpsRoute = useRef<{
    time: number;
    point: DevicePosition;
    job: string;
  }>(null);
  const gpsFresh = !gps.stale && !!gps.position && gps.position.accuracy <= 100;
  useEffect(() => {
    let alive = true;
    api<Serialized<MapData>>("maps")
      .then((result) => {
        if (alive) {
          setData((prev) =>
            JSON.stringify(prev) === JSON.stringify(result) ? prev : result,
          );
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
  }, [revision, liveRevision]);
  const idsKey = JSON.stringify(jobIds ?? null);
  const eligibleRows = useMemo(() => {
    const ids: string[] | null = JSON.parse(idsKey);
    return data?.rows.filter((row) => !ids || ids.includes(row.id)) ?? [];
  }, [data, idsKey]);
  const rows = useMemo(
    () => eligibleRows.filter((r) => selected === "all" || r.id === selected),
    [eligibleRows, selected],
  );
  const current = selected === "all" ? undefined : rows[0];
  const filteredJobs = eligibleRows.filter((row) =>
    `${row.number} ${row.customerName} ${row.origin} ${row.destination}`
      .toLocaleLowerCase("id")
      .includes(searchQuery.trim().toLocaleLowerCase("id")),
  );
  const shownJobs = showAllJobs ? filteredJobs : filteredJobs.slice(0, 10);
  // Avoid flooding routing services: follow only meaningful movement, at most once/30s.
  useEffect(() => {
    if (!fromGPS || !gpsFresh || !gps.position) return;
    const prior = lastGpsRoute.current;
    const point = gps.position;
    const moved = prior
      ? Math.hypot(
          (point.lat - prior.point.lat) * 111320,
          (point.lng - prior.point.lng) *
            111320 *
            Math.cos((point.lat * Math.PI) / 180),
        )
      : Infinity;
    if (
      prior?.job === selected &&
      (Date.now() - prior.time < 30000 || moved < 50)
    )
      return;
    const timer = window.setTimeout(() => {
      lastGpsRoute.current = { time: Date.now(), point, job: selected };
      setGpsOrigin(point);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fromGPS, gpsFresh, gps.position, selected]);
  const validGpsOrigin =
    fromGPS && gpsFresh && gpsOrigin ? gpsOrigin : undefined;
  const locationKey = current?.location ? JSON.stringify(current.location) : "";
  const currentId = current?.id;
  useEffect(() => {
    if (!currentId || !locationKey || (fromGPS && !validGpsOrigin)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRouting(true);
      setRoute(undefined);
      setRouteError("");
      const params = new URLSearchParams();
      if (validGpsOrigin) {
        params.set("lat", validGpsOrigin.lat.toFixed(5));
        params.set("lng", validGpsOrigin.lng.toFixed(5));
      }
      try {
        const result = await fetch(`/api/jobs/${currentId}/route?${params}`, {
          signal: controller.signal,
          headers: workspaceHeaders(),
        });
        const body = await result.json();
        if (!result.ok) throw new Error(body.error || "Rute gagal dimuat.");
        if (!controller.signal.aborted) setRoute({ ...body, jobId: currentId });
      } catch (e) {
        if (!controller.signal.aborted)
          setRouteError(e instanceof Error ? e.message : "Rute gagal dimuat.");
      } finally {
        if (!controller.signal.aborted) setRouting(false);
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentId, locationKey, fromGPS, validGpsOrigin, routeRevision]);
  const selectJob = useCallback((id: string) => {
    setSelected(id);
    setRoute(undefined);
    setRouteError("");
    setRouting(false);
    setFromGPS(false);
    setRouteRevision((v) => v + 1);
    lastGpsRoute.current = null;
  }, []);
  useEffect(() => {
    if (
      selected !== "all" &&
      data &&
      !eligibleRows.some((r) => r.id === selected)
    ) {
      const timer = window.setTimeout(() => selectJob("all"), 0);
      return () => window.clearTimeout(timer);
    }
  }, [data, eligibleRows, selected, selectJob]);
  function edit(row: Row) {
    setEditing(row);
    setError("");
    setSuccess("");
    setEndpoint("origin");
    setPoints({
      origin: row.location
        ? {
            lat: row.location.originLat,
            lng: row.location.originLng,
            label: row.location.originLabel || row.origin,
          }
        : undefined,
      destination: row.location
        ? {
            lat: row.location.destinationLat,
            lng: row.location.destinationLng,
            label: row.location.destinationLabel || row.destination,
          }
        : undefined,
    });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      if (!points.origin || !points.destination)
        throw new Error("Pilih asal dan tujuan pada peta sebelum menyimpan.");
      const stored = await api<NonNullable<Row["location"]>>(
        `jobs/${editing.id}/location`,
        {
          originLat: points.origin.lat,
          originLng: points.origin.lng,
          destinationLat: points.destination.lat,
          destinationLng: points.destination.lng,
          originLabel: points.origin.label,
          destinationLabel: points.destination.label,
        },
      );
      setData((previous) =>
        previous
          ? {
              ...previous,
              rows: previous.rows.map((row) =>
                row.id === editing.id ? { ...row, location: stored } : row,
              ),
            }
          : previous,
      );
      selectJob(editing.id);
      setEditing(null);
      setSuccess("Lokasi tersimpan.");
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koordinat gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }
  const visibleRoute =
    route?.jobId === current?.id && (!fromGPS || gpsFresh) ? route : undefined;
  return (
    <div className="job-map-page">
      <Feedback error={!editing ? error : ""} success={success} />
      {loading ? (
        <LoadingState text="Memuat lokasi job…" />
      ) : (
        data && (
          <>
            <div
              className={`map-toolbar ${embedded ? "" : "map-selection-toolbar"}`}
            >
              <div className="map-job-selector">
                <Select<string>
                  className="w-full min-w-0 max-w-full"
                  label="Job pada peta"
                  value={selected}
                  items={{
                    all: "Semua job yang dapat diakses",
                    ...Object.fromEntries(
                      eligibleRows.map((r) => [
                        r.id,
                        `${r.number} · ${r.customerName}`,
                      ]),
                    ),
                  }}
                  onValueChange={(value) => {
                    if (value !== null) selectJob(value);
                  }}
                />
              </div>
              {embedded && (
                <ToolbarAction
                  variant={gps.tracking ? "outline" : "primary"}
                  aria-label={gps.tracking ? "Matikan GPS" : "Aktifkan GPS"}
                  className="toolbar-icon-action"
                  icon={<CrosshairIcon size={18} />}
                  onClick={() => {
                    if (gps.tracking) {
                      gps.stop();
                      setFromGPS(false);
                      setGpsOrigin(undefined);
                      lastGpsRoute.current = null;
                    } else gps.start();
                  }}
                >
                  {gps.tracking ? "Matikan GPS" : "Aktifkan GPS"}
                </ToolbarAction>
              )}
            </div>
            <Feedback error={gps.error} />
            {gps.tracking && (
              <div className="map-gps-status" role="status">
                <Badge variant={gpsFresh ? "success" : "warning"}>
                  {gps.stale
                    ? "Posisi belum diperbarui"
                    : gps.position
                      ? "GPS aktif"
                      : "Mencari posisi"}
                </Badge>
                <Text>
                  {gps.position
                    ? `Akurasi ±${Math.round(gps.position.accuracy)} m · ${new Date(gps.position.timestamp).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`
                    : "Izinkan akses lokasi pada browser Anda."}
                </Text>
                {gps.position && gps.position.accuracy > 100 && (
                  <Text variant="secondary">
                    Sinyal belum cukup akurat untuk rute dari posisi Anda. Coba
                    di area terbuka.
                  </Text>
                )}
              </div>
            )}

            <div className="map-workspace">
              {!embedded && (
                <aside className="map-jobs-sidebar">
                  <SectionPanel title="Daftar job">
                    <div className="map-job-search">
                      <Input
                        aria-label="Cari job pada peta"
                        placeholder="Cari nomor job, customer, rute…"
                        value={jobQuery}
                        onChange={(event) => {
                          setJobQuery(event.target.value);
                          setShowAllJobs(false);
                        }}
                      />
                    </div>
                    <div
                      className="map-job-options"
                      aria-label="Daftar job pada peta"
                    >
                      {!filteredJobs.length && (
                        <Text
                          variant="secondary"
                          DANGEROUS_className="map-jobs-empty"
                        >
                          Job tidak ditemukan.
                        </Text>
                      )}
                      {shownJobs.map((row) => (
                        <Button
                          key={row.id}
                          variant={selected === row.id ? "secondary" : "ghost"}
                          className="map-job-option"
                          aria-pressed={selected === row.id}
                          onClick={() => selectJob(row.id)}
                        >
                          <span className="map-job-option-heading">
                            <Text as="strong">{row.number}</Text>
                            <Status value={row.status} />
                          </span>
                          <Text variant="secondary">{row.customerName}</Text>
                          <Text>
                            {row.origin} → {row.destination}
                          </Text>
                          <span className="map-job-location-status">
                            <MapPinIcon size={14} />
                            {row.location
                              ? "Lokasi ditetapkan"
                              : "Lokasi belum ditetapkan"}
                          </span>
                        </Button>
                      ))}
                    </div>
                    {filteredJobs.length > 10 && (
                      <div className="map-jobs-footer">
                        <Button
                          variant="ghost"
                          onClick={() => setShowAllJobs(!showAllJobs)}
                        >
                          {showAllJobs
                            ? "Ringkas daftar"
                            : `Tampilkan semua (${filteredJobs.length})`}
                        </Button>
                      </div>
                    )}
                  </SectionPanel>
                </aside>
              )}
              <div className="map-workspace-main">
                {!embedded && (
                  <div className="map-selection-summary">
                    <div>
                      <Text as="h2" variant="heading">
                        {current?.number || "Lokasi pekerjaan"}
                      </Text>
                      <Text variant="secondary">
                        {current?.customerName ||
                          "Pilih job untuk melihat rute dan mengatur lokasi."}
                      </Text>
                    </div>
                    {current && (
                      <div className="map-route-actions">
                        <LinkButton
                          href={`/jobs/${current.id}`}
                          variant="outline"
                        >
                          Buka job
                        </LinkButton>
                        {actor &&
                          can(actor, "jobsWrite") &&
                          current.status !== "cancelled" && (
                            <Button
                              variant="primary"
                              icon={<MapPinIcon size={18} />}
                              onClick={() => edit(current)}
                            >
                              {current.location
                                ? "Ubah lokasi"
                                : "Tetapkan lokasi"}
                            </Button>
                          )}
                      </div>
                    )}
                  </div>
                )}
                {current && (
                  <SectionPanel
                    title="Rute perjalanan"
                    className="map-route-panel"
                    description={
                      fromGPS
                        ? "Posisi Anda → tujuan job"
                        : `${current.location?.originLabel && current.location.originLabel !== "Titik dipilih pada peta" ? current.location.originLabel : current.origin} → ${current.location?.destinationLabel && current.location.destinationLabel !== "Titik dipilih pada peta" ? current.location.destinationLabel : current.destination}`
                    }
                    action={
                      <div className="map-route-actions">
                        {current.location && (
                          <ToolbarLink
                            aria-label="Buka rute di OpenStreetMap"
                            className="toolbar-icon-action"
                            variant="outline"
                            href={mapDirectionsLink(
                              fromGPS && gps.position
                                ? gps.position
                                : {
                                    lat: current.location.originLat,
                                    lng: current.location.originLng,
                                  },
                              {
                                lat: current.location.destinationLat,
                                lng: current.location.destinationLng,
                              },
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            icon={<ArrowSquareOutIcon size={16} />}
                          >
                            OpenStreetMap
                          </ToolbarLink>
                        )}
                        {current.location && (
                          <Button
                            variant="outline"
                            aria-label="Cari ulang rute"
                            shape="square"
                            icon={<ArrowClockwiseIcon size={16} />}
                            disabled={routing || (fromGPS && !gpsFresh)}
                            onClick={() => {
                              if (fromGPS && gps.position) {
                                lastGpsRoute.current = {
                                  time: Date.now(),
                                  point: gps.position,
                                  job: selected,
                                };
                                setGpsOrigin(gps.position);
                              }
                              setRouteRevision((r) => r + 1);
                            }}
                          />
                        )}
                        {current.location && (
                          <ToolbarAction
                            variant="outline"
                            aria-label={
                              fromGPS
                                ? "Rute dari asal job"
                                : "Rute dari posisi saya"
                            }
                            className="toolbar-icon-action"
                            icon={<NavigationArrowIcon size={16} />}
                            onClick={() => {
                              if (fromGPS && !embedded) {
                                gps.stop();
                                setGpsOrigin(undefined);
                                lastGpsRoute.current = null;
                              }
                              if (!fromGPS && !gps.tracking) gps.start();
                              setFromGPS(!fromGPS);
                              setRoute(undefined);
                              setRouteError("");
                              if (!fromGPS && gps.position) {
                                lastGpsRoute.current = {
                                  time: Date.now(),
                                  point: gps.position,
                                  job: selected,
                                };
                                setGpsOrigin(gps.position);
                              }
                            }}
                          >
                            {fromGPS
                              ? "Rute dari asal job"
                              : "Rute dari posisi saya"}
                          </ToolbarAction>
                        )}
                      </div>
                    }
                  >
                    <div className="map-route-body">
                      <Feedback error={routeError} />
                      {!current.location ? (
                        <Text>
                          Operations perlu menetapkan koordinat asal dan tujuan
                          sebelum rute dapat dicari.
                        </Text>
                      ) : fromGPS && !gpsFresh ? (
                        <Text>
                          Menunggu posisi GPS yang akurat dan terbaru. Rute akan
                          diperbarui setelah sinyal tersedia.
                        </Text>
                      ) : routing ? (
                        <LoadingState text="Mencari rute jalan…" />
                      ) : (
                        visibleRoute && (
                          <>
                            <div className="map-route-summary" role="status">
                              <Text as="strong">
                                {distanceText(visibleRoute.distanceMeters)}
                              </Text>
                              <Text>
                                Estimasi{" "}
                                {Math.max(
                                  1,
                                  Math.round(visibleRoute.durationSeconds / 60),
                                )}{" "}
                                menit
                              </Text>
                              <Badge variant="secondary">Rute berkendara</Badge>
                            </div>
                            <Text variant="secondary">
                              Periksa akses truk. Estimasi belum memperhitungkan
                              lalu lintas langsung.
                            </Text>
                            <Collapsible.Root>
                              <Collapsible.DefaultTrigger>{`Petunjuk perjalanan (${visibleRoute.steps.length})`}</Collapsible.DefaultTrigger>
                              <Collapsible.DefaultPanel>
                                <ol className="map-route-steps">
                                  {visibleRoute.steps.map((step, index) => (
                                    <li key={index}>
                                      <div>
                                        <Text>{maneuverText(step)}</Text>
                                        {step.road && (
                                          <Text variant="secondary">
                                            {step.road}
                                          </Text>
                                        )}
                                      </div>
                                      <Text variant="secondary">
                                        {distanceText(step.distanceMeters)}
                                      </Text>
                                    </li>
                                  ))}
                                </ol>
                              </Collapsible.DefaultPanel>
                            </Collapsible.Root>
                          </>
                        )
                      )}
                    </div>
                  </SectionPanel>
                )}

                <MapCanvas
                  rows={eligibleRows}
                  route={visibleRoute}
                  position={gps.position}
                  onSelectJob={selectJob}
                  selectedJobId={selected}
                />
                <Text variant="secondary">Oranye: asal · Hitam: tujuan</Text>
              </div>
            </div>
          </>
        )
      )}
      <JobLocationDialog
        job={editing}
        points={points}
        endpoint={endpoint}
        onEndpointChange={setEndpoint}
        onPointChange={(point) =>
          setPoints((previous) => ({ ...previous, [endpoint]: point }))
        }
        error={error}
        busy={busy}
        onClose={() => setEditing(null)}
        onSubmit={submit}
      />
    </div>
  );
}

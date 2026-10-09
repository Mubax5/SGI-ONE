"use client";
import { Button, Input, LinkButton, Select, Text } from "@cloudflare/kumo";
import { MapPinIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapData } from "@/modules/maps";
import { Actor, can } from "@/lib/domain";
import { api, Feedback, Modal, Refresh, SectionPanel, Status } from "./shared";
import { LoadingState, PageHeader } from "./workspace-ui";
import type { Serialized } from "./types";
type Row = Serialized<MapData>["rows"][number];
type Coordinates = {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
};
function MapCanvas({ rows }: { rows: Row[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let instance: import("leaflet").Map | undefined;
    let observer: ResizeObserver | undefined;
    import("leaflet")
      .then((L) => {
        if (!active || !container.current) return;
        instance = L.map(container.current, { scrollWheelZoom: false }).setView(
          [-6.25, 106.95],
          10,
        );
        const styles = getComputedStyle(container.current);
        const orange = styles.getPropertyValue("--color-kumo-brand").trim();
        const ink = styles.getPropertyValue("--text-color-kumo-default").trim();
        L.tileLayer(
          process.env.NEXT_PUBLIC_MAP_TILE_URL ||
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            // Tile requests send the site origin required by OSM, without job URLs.
            referrerPolicy: "strict-origin-when-cross-origin",
            attribution:
              process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        )
          .on("tileerror", () => {
            if (active)
              setError(
                "Sebagian peta belum termuat. Periksa koneksi internet; koordinat job tetap tersedia di bawah.",
              );
          })
          .addTo(instance);
        const bounds: [number, number][] = [];
        for (const row of rows) {
          if (!row.location) continue;
          const p = row.location;
          const points: [number, number][] = [
            [p.originLat, p.originLng],
            [p.destinationLat, p.destinationLng],
          ];
          bounds.push(...points);
          L.polyline(points, { color: ink, weight: 2, dashArray: "5 7" }).addTo(
            instance,
          );
          points.forEach((point, index) => {
            const content = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = row.number;
            const detail = document.createElement("p");
            detail.textContent = `${index === 0 ? "Asal" : "Tujuan"}: ${index === 0 ? row.origin : row.destination}`;
            const link = document.createElement("a");
            const role = new URLSearchParams(window.location.search).get(
              "role",
            );
            link.href = `/jobs/${row.id}${role ? `?role=${encodeURIComponent(role)}` : ""}`;
            link.textContent = "Buka job";
            content.append(title, detail, link);
            L.circleMarker(point, {
              radius: 8,
              color: index === 0 ? orange : ink,
              fillColor: index === 0 ? orange : ink,
              fillOpacity: 1,
              weight: 2,
            })
              .bindTooltip(`${row.number} · ${index === 0 ? "Asal" : "Tujuan"}`)
              .bindPopup(content)
              .addTo(instance!);
          });
        }
        if (bounds.length)
          instance.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
        observer = new ResizeObserver(() => instance?.invalidateSize());
        observer.observe(container.current);
      })
      .catch(() => {
        if (active)
          setError(
            "Peta gagal dimuat. Muat ulang halaman atau gunakan daftar koordinat job.",
          );
      });
    return () => {
      active = false;
      observer?.disconnect();
      instance?.remove();
    };
  }, [rows]);
  return (
    <>
      <div
        ref={container}
        className="job-map-canvas"
        aria-label="Peta titik asal dan tujuan job"
      />
      <Feedback error={error} />
    </>
  );
}
export function JobMap({ actor }: { actor: Actor }) {
  const [data, setData] = useState<Serialized<MapData>>();
  const [selected, setSelected] = useState("all");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<keyof Coordinates, string>>({
    originLat: "",
    originLng: "",
    destinationLat: "",
    destinationLng: "",
  });
  useEffect(() => {
    let alive = true;
    api<Serialized<MapData>>("maps")
      .then((result) => {
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
  }, [revision]);
  const rows = useMemo(
    () =>
      data?.rows.filter((r) => selected === "all" || r.id === selected) ?? [],
    [data, selected],
  );
  function edit(row: Row) {
    setEditing(row);
    setError("");
    setSuccess("");
    setForm({
      originLat: row.location ? String(row.location.originLat) : "",
      originLng: row.location ? String(row.location.originLng) : "",
      destinationLat: row.location ? String(row.location.destinationLat) : "",
      destinationLng: row.location ? String(row.location.destinationLng) : "",
    });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      await api(`jobs/${editing.id}/location`, {
        ...Object.fromEntries(
          Object.entries(form).map(([k, v]) => [k, Number(v)]),
        ),
      });
      setEditing(null);
      setSuccess("Koordinat tersimpan. Peta sudah diperbarui.");
      setLoading(true);
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koordinat gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="job-map-page">
      <PageHeader
        title="Peta pekerjaan"
        template="standard"
        description="Titik asal dan tujuan dari job yang dapat Anda akses."
        actions={
          <Refresh
            loading={loading}
            onClick={() => {
              setLoading(true);
              setRevision((r) => r + 1);
            }}
          />
        }
      />
      <Feedback error={!editing ? error : ""} success={success} />
      {loading ? (
        <LoadingState text="Memuat lokasi job…" />
      ) : (
        data && (
          <>
            <Select<string>
              label="Job pada peta"
              value={selected}
              items={{
                all: "Semua job yang dapat diakses",
                ...Object.fromEntries(
                  data.rows.map((r) => [
                    r.id,
                    `${r.number} · ${r.customerName}`,
                  ]),
                ),
              }}
              onValueChange={(value) => setSelected(value ?? "all")}
            />
            <MapCanvas key={revision + selected} rows={rows} />
            <Text variant="secondary">
              Asal: titik oranye · Tujuan: titik hitam. Garis menghubungkan dua
              titik, bukan rute jalan atau pelacakan GPS langsung.
            </Text>
            <SectionPanel
              title="Lokasi job"
              description={`${rows.filter((r) => r.location).length} dari ${rows.length} job mempunyai koordinat.`}
            >
              <div className="map-job-list">
                {rows.length === 0 ? (
                  <Text>
                    Belum ada job yang dapat diakses. Operations dapat membuat
                    dan menugaskan pekerjaan.
                  </Text>
                ) : (
                  rows.map((row) => (
                    <article key={row.id} className="map-job-row">
                      <div>
                        <LinkButton variant="ghost" href={`/jobs/${row.id}`}>
                          {row.number}
                        </LinkButton>
                        <Status value={row.status} />
                        <Text>
                          {row.origin} → {row.destination}
                        </Text>
                        <Text variant="secondary">
                          {row.location
                            ? `${row.location.originLat}, ${row.location.originLng} → ${row.location.destinationLat}, ${row.location.destinationLng}`
                            : "Koordinat belum ditetapkan oleh Operations."}
                        </Text>
                      </div>
                      {can(actor, "jobsWrite") &&
                        row.status !== "cancelled" && (
                          <Button
                            variant="primary"
                            icon={<MapPinIcon size={16} />}
                            onClick={() => edit(row)}
                          >
                            {row.location ? "Ubah lokasi" : "Tetapkan lokasi"}
                          </Button>
                        )}
                    </article>
                  ))
                )}
              </div>
            </SectionPanel>
          </>
        )
      )}
      <Modal
        open={Boolean(editing)}
        onClose={() => {
          if (!busy) setEditing(null);
        }}
        title="Koordinat asal dan tujuan"
        description={`${editing?.number ?? ""} · masukkan koordinat lokasi yang sudah diketahui.`}
      >
        <form onSubmit={submit}>
          <Feedback error={error} />
          <div className="map-coordinate-grid">
            {(
              [
                ["originLat", "Latitude asal"],
                ["originLng", "Longitude asal"],
                ["destinationLat", "Latitude tujuan"],
                ["destinationLng", "Longitude tujuan"],
              ] as const
            ).map(([key, label]) => (
              <Input
                key={key}
                label={label}
                required
                type="number"
                step="any"
                min={key.endsWith("Lat") ? -90 : -180}
                max={key.endsWith("Lat") ? 90 : 180}
                value={form[key]}
                onChange={(event) =>
                  setForm((values) => ({
                    ...values,
                    [key]: event.target.value,
                  }))
                }
              />
            ))}
          </div>
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Batal
            </Button>
            <Button variant="primary" type="submit" loading={busy}>
              Simpan koordinat
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

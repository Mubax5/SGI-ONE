"use client";
import { Button } from "@cloudflare/kumo";
import {
  CrosshairIcon,
  MapPinIcon,
  MinusIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { MapData } from "@/modules/maps";
import type { RoadRoute } from "@/lib/road-routing";
import type { DevicePosition } from "@/lib/device-location";
import { Feedback } from "./shared";
import type { Serialized } from "./types";
import { mapSearchLink } from "@/lib/map-links";
type Row = Serialized<MapData>["rows"][number];
type VisibleRoute = RoadRoute & { jobId: string };
export function MapCanvas({
  rows,
  route,
  position,
  onSelectJob,
  selectedJobId,
}: {
  rows: Row[];
  route?: VisibleRoute;
  position?: DevicePosition;
  onSelectJob?: (id: string) => void;
  selectedJobId?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<typeof Leaflet>(null);
  const [map, setMap] = useState<Leaflet.Map>();
  const [error, setError] = useState("");
  const fit = useRef<() => void>(() => {});
  const markerIndex = useRef<{ marker: Leaflet.Marker; jobId: string }[]>([]);
  const selection = useRef(selectedJobId);
  const popupJob = useRef<string | null>(null);
  useEffect(() => {
    selection.current = selectedJobId;
  }, [selectedJobId]);
  useEffect(() => {
    let active = true;
    let instance: Leaflet.Map | undefined, observer: ResizeObserver | undefined;
    import("leaflet")
      .then((L) => {
        if (!active || !container.current) return;
        engine.current = L;
        const motion = !window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches;
        instance = L.map(container.current, {
          scrollWheelZoom: true,
          touchZoom: true,
          zoomSnap: 0.25,
          zoomDelta: 0.5,
          wheelPxPerZoomLevel: 120,
          zoomAnimation: motion,
          fadeAnimation: motion,
          markerZoomAnimation: motion,
          zoomControl: false,
        }).setView([-6.25, 106.95], 10);
        L.tileLayer(
          process.env.NEXT_PUBLIC_MAP_TILE_URL ||
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            referrerPolicy: "strict-origin-when-cross-origin",
            attribution:
              process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        )
          .on("tileerror", () => {
            if (active)
              setError(
                "Sebagian peta belum termuat. Periksa koneksi internet; rincian rute tetap tersedia.",
              );
          })
          .addTo(instance);
        observer = new ResizeObserver(() => instance?.invalidateSize());
        observer.observe(container.current);
        setMap(instance);
      })
      .catch(() => {
        if (active)
          setError(
            "Peta gagal dimuat. Muat ulang halaman atau gunakan rincian rute.",
          );
      });
    return () => {
      active = false;
      observer?.disconnect();
      instance?.remove();
    };
  }, []);
  // Keep markers alive while selection and routing change.
  useEffect(() => {
    const L = engine.current;
    if (!map || !L || !container.current) return;
    const group = L.featureGroup().addTo(map);
    const index: { marker: Leaflet.Marker; jobId: string }[] = [];
    const styles = getComputedStyle(container.current);
    const brand = styles.getPropertyValue("--color-kumo-brand").trim(),
      ink = styles.getPropertyValue("--text-color-kumo-default").trim();
    for (const row of rows) {
      const p = row.location;
      if (!p) continue;
      (
        [
          [p.originLat, p.originLng],
          [p.destinationLat, p.destinationLng],
        ] as [number, number][]
      ).forEach((point, i) => {
        const label =
          i === 0
            ? p.originLabel || row.origin
            : p.destinationLabel || row.destination;
        const title = window.document.createElement("strong"),
          detail = window.document.createElement("p"),
          content = window.document.createElement("div");
        title.textContent = row.number;
        detail.textContent = (i === 0 ? "Asal: " : "Tujuan: ") + label;
        content.append(title, detail);
        const jobLink = window.document.createElement("a");
        jobLink.textContent = "Buka job";
        jobLink.href = "/jobs/" + row.id;
        content.append(jobLink);
        function appendLink(text: string, url: string) {
          const link = window.document.createElement("a");
          link.textContent = text;
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          content.append(window.document.createElement("br"), link);
        }
        appendLink(
          "OpenStreetMap",
          mapSearchLink({ lat: point[0], lng: point[1] }),
        );
        const marker = L.marker(point, {
          icon: L.divIcon({
            className: "job-place-marker",
            html: "<span></span>",
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          }),
          title: row.number + " · " + (i === 0 ? "Asal" : "Tujuan"),
          keyboard: true,
        })
          .bindTooltip(row.number + " · " + (i === 0 ? "Asal" : "Tujuan"))
          .bindPopup(content, { keepInView: true })
          .on("popupopen", () => {
            popupJob.current = row.id;
          })
          .on("popupclose", () => {
            if (popupJob.current === row.id) popupJob.current = null;
          })
          .on("click", () => {
            if (row.id !== selection.current) onSelectJob?.(row.id);
          })
          .addTo(group);
        marker
          .getElement()
          ?.style.setProperty("--point-color", i === 0 ? brand : ink);
        marker.getElement()?.setAttribute("role", "button");
        marker
          .getElement()
          ?.setAttribute(
            "aria-label",
            row.number + " · " + (i === 0 ? "Asal" : "Tujuan"),
          );
        index.push({ marker, jobId: row.id });
      });
    }
    markerIndex.current = index;
    return () => {
      group.remove();
      markerIndex.current = [];
    };
  }, [map, rows, onSelectJob]);
  useEffect(() => {
    const L = engine.current;
    if (!map || !L || !container.current) return;
    if (popupJob.current && popupJob.current !== selectedJobId)
      map.closePopup();
    const group = L.featureGroup().addTo(map);
    const brand = getComputedStyle(container.current)
      .getPropertyValue("--color-kumo-brand")
      .trim();
    markerIndex.current.forEach(({ marker, jobId }) =>
      marker.setZIndexOffset(jobId === selectedJobId ? 1000 : 0),
    );
    const focus = rows.find((r) => r.id === selectedJobId)?.location;
    const routePoints = route?.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number],
    );
    if (routePoints?.length)
      L.polyline(routePoints, {
        color: brand,
        weight: 5,
        opacity: 0.9,
        className: "road-route-line",
        interactive: false,
      }).addTo(group);
    fit.current = () => {
      const points = routePoints?.length
        ? routePoints
        : focus
          ? ([
              [focus.originLat, focus.originLng],
              [focus.destinationLat, focus.destinationLng],
            ] as [number, number][])
          : rows.flatMap((r) =>
              r.location
                ? ([
                    [r.location.originLat, r.location.originLng],
                    [r.location.destinationLat, r.location.destinationLng],
                  ] as [number, number][])
                : [],
            );
      if (points.length)
        map.fitBounds(L.latLngBounds(points), {
          padding: [24, 24],
          maxZoom: 15,
          animate: false,
        });
    };
    fit.current();
    return () => {
      group.remove();
    };
  }, [map, rows, route, selectedJobId]);
  useEffect(() => {
    const L = engine.current;
    if (!map || !L || !position || !container.current) return;
    const group = L.featureGroup().addTo(map);
    const color =
      getComputedStyle(container.current)
        .getPropertyValue("--color-kumo-info")
        .trim() ||
      getComputedStyle(container.current)
        .getPropertyValue("--color-kumo-brand")
        .trim();
    L.circle([position.lat, position.lng], {
      radius: position.accuracy,
      color,
      weight: 1,
      fillOpacity: 0.12,
    }).addTo(group);
    L.circleMarker([position.lat, position.lng], {
      radius: 7,
      color,
      fillColor: color,
      fillOpacity: 1,
      weight: 3,
      className: "device-location-marker",
    })
      .bindTooltip("Posisi perangkat Anda")
      .addTo(group);
    return () => {
      group.remove();
    };
  }, [map, position]);
  return (
    <div className="map-surface">
      <div className="map-controls" aria-label="Kontrol peta">
        <Button
          variant="outline"
          aria-label="Perbesar peta"
          disabled={!map}
          onClick={() => map?.zoomIn()}
          icon={<PlusIcon size={18} />}
        />
        <Button
          variant="outline"
          aria-label="Perkecil peta"
          disabled={!map}
          onClick={() => map?.zoomOut()}
          icon={<MinusIcon size={18} />}
        />
        <Button
          variant="outline"
          disabled={!map}
          onClick={() => fit.current()}
          icon={<MapPinIcon size={18} />}
        >
          {route ? "Cakupan rute" : "Cakupan lokasi"}
        </Button>
        {position && (
          <Button
            variant="outline"
            disabled={!map}
            onClick={() =>
              map?.setView([position.lat, position.lng], 16, { animate: false })
            }
            icon={<CrosshairIcon size={18} />}
          >
            Posisi saya
          </Button>
        )}
      </div>
      <div
        ref={container}
        className="job-map-canvas"
        aria-label="Peta OpenStreetMap dan rute jalan pekerjaan"
      />
      <Feedback error={error} />
    </div>
  );
}

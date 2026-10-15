"use client";
import { Button } from "@cloudflare/kumo";
import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Feedback } from "./shared";
import type { MapPoint } from "@/lib/map-links";
export function MapPointPicker({
  value,
  onPick,
}: {
  value?: MapPoint;
  onPick: (point: MapPoint) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map>(null),
    marker = useRef<Leaflet.Marker>(null),
    engine = useRef<typeof Leaflet>(null);
  const callback = useRef(onPick),
    current = useRef(value),
    picked = useRef("");
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    callback.current = onPick;
    current.current = value;
  }, [onPick, value]);
  useEffect(() => {
    let alive = true;
    let observer: ResizeObserver | undefined;
    import("leaflet")
      .then((L) => {
        if (!alive || !root.current) return;
        engine.current = L;
        const instance = L.map(root.current, {
          zoomControl: false,
          touchZoom: true,
          scrollWheelZoom: true,
          zoomSnap: 0.25,
          zoomAnimation: !matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
          fadeAnimation: !matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
          markerZoomAnimation: !matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
        }).setView(
          current.current
            ? [current.current.lat, current.current.lng]
            : [-6.23498, 106.99454],
          current.current ? 17 : 11,
        );
        map.current = instance;
        L.tileLayer(
          process.env.NEXT_PUBLIC_MAP_TILE_URL ||
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            referrerPolicy: "strict-origin-when-cross-origin",
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        )
          .on("tileerror", () => {
            if (alive)
              setError(
                "Sebagian peta belum termuat. Periksa koneksi internet.",
              );
          })
          .addTo(instance);
        const pick = (latlng: Leaflet.LatLng) => {
          picked.current = `${latlng.lat},${latlng.lng}`;
          callback.current({
            lat: latlng.lat,
            lng: latlng.lng,
            label: "Titik dipilih pada peta",
          });
        };
        instance.on("click", (e) => pick(e.latlng));
        // Double click can place a pin and zoom. Keyboard and zoom controls remain available.
        instance.on("keypress", (e) => {
          if (e.originalEvent.key === "Enter") pick(instance.getCenter());
        });
        observer = new ResizeObserver(() => instance.invalidateSize());
        observer.observe(root.current);
        setReady(true);
      })
      .catch(() =>
        setError("Peta gagal dimuat. Muat ulang halaman lalu coba kembali."),
      );
    return () => {
      alive = false;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);
  useEffect(() => {
    const L = engine.current,
      instance = map.current;
    if (!ready || !value || !L || !instance) return;
    const coords: [number, number] = [value.lat, value.lng];
    if (!marker.current) {
      marker.current = L.marker(coords, {
        draggable: true,
        title: "Titik lokasi — geser untuk menyesuaikan",
        keyboard: true,
        icon: L.divIcon({
          className: "location-picker-pin",
          html: '<span aria-hidden="true"></span>',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
      }).addTo(instance);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLatLng();
        picked.current = `${p.lat},${p.lng}`;
        callback.current({
          lat: p.lat,
          lng: p.lng,
          label: "Titik dipilih pada peta",
        });
      });
    } else marker.current.setLatLng(coords);
    if (picked.current !== `${value.lat},${value.lng}`)
      instance.setView(coords, 17, { animate: false });
  }, [ready, value]);
  return (
    <div className="point-canvas-wrap">
      <div
        className="point-canvas"
        ref={root}
        role="application"
        aria-label="Pilih titik pada peta OpenStreetMap"
      />
      <div className="point-zoom-controls">
        <Button
          type="button"
          shape="square"
          variant="outline"
          aria-label="Perbesar pemilih lokasi"
          icon={<PlusIcon size={18} />}
          disabled={!ready}
          onClick={() => map.current?.zoomIn()}
        />
        <Button
          type="button"
          shape="square"
          variant="outline"
          aria-label="Perkecil pemilih lokasi"
          icon={<MinusIcon size={18} />}
          disabled={!ready}
          onClick={() => map.current?.zoomOut()}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const p = map.current?.getCenter();
            if (p)
              callback.current({
                lat: p.lat,
                lng: p.lng,
                label: "Titik dipilih pada peta",
              });
          }}
          disabled={!ready}
        >
          Pilih titik tengah
        </Button>
      </div>
      <Feedback error={error} />
    </div>
  );
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export type DevicePosition = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
};
export function useDeviceLocation() {
  const watch = useRef<number | null>(null);
  const [position, setPosition] = useState<DevicePosition>();
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const stop = useCallback(() => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setTracking(false);
    setPosition(undefined);
    setError("");
  }, []);
  const start = useCallback(() => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setError(
        "Lokasi tidak dapat diakses. Buka aplikasi melalui koneksi HTTPS dan izinkan lokasi.",
      );
      return;
    }
    if (watch.current !== null) return;
    setError("");
    setPosition(undefined);
    setTracking(true);
    watch.current = navigator.geolocation.watchPosition(
      (fix) => {
        setPosition({
          lat: fix.coords.latitude,
          lng: fix.coords.longitude,
          accuracy: fix.coords.accuracy,
          timestamp: fix.timestamp,
        });
        setNow(Date.now());
        setError("");
      },
      (failure) => {
        setError(
          failure.code === 1
            ? "Izin lokasi ditolak. Izinkan lokasi pada pengaturan browser, lalu aktifkan GPS kembali."
            : failure.code === 2
              ? "Posisi belum tersedia. Pastikan layanan lokasi perangkat aktif dan coba di area terbuka."
              : "GPS belum mendapatkan posisi. Periksa sinyal dan aktifkan kembali bila diperlukan.",
        );
        if (failure.code === 1) {
          if (watch.current !== null)
            navigator.geolocation.clearWatch(watch.current);
          watch.current = null;
          setTracking(false);
          setPosition(undefined);
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }, []);
  useEffect(() => {
    if (!tracking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, [tracking]);
  useEffect(
    () => () => {
      if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current);
    },
    [],
  );
  return {
    position,
    tracking,
    error,
    start,
    stop,
    stale: !!position && now - position.timestamp > 60000,
  };
}

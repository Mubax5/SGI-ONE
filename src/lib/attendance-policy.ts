import { DomainError } from "./domain";
export const ATTENDANCE_POLICY = {
  maximumAccuracy: 100,
  maximumRemoteAccuracy: 5000,
  maximumAge: 60000,
  jobRadius: 200,
  maximumPhotoBytes: 5 * 1024 * 1024,
};
export type AttendanceTarget = {
  key: string;
  label: string;
  placeLabel?: string;
  lat: number;
  lng: number;
  radius: number;
};
export function distanceBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dlat = rad(b.lat - a.lat),
    dlng = rad(b.lng - a.lng);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function checkAttendanceFix(
  fix: { lat: number; lng: number; accuracy: number; timestamp: number },
  target: AttendanceTarget,
  now = Date.now(),
) {
  checkAttendanceSample(fix, ATTENDANCE_POLICY.maximumAccuracy, now);
  const distance = distanceBetween(fix, target);
  if (!Number.isFinite(distance) || distance + fix.accuracy > target.radius)
    throw new DomainError(
      `Anda belum berada dalam area ${target.label}. Dekati lokasi dan pastikan sinyal GPS akurat.`,
      422,
    );
  return distance;
}
export function checkAttendanceSample(
  fix: { accuracy: number; timestamp: number },
  maximumAccuracy = ATTENDANCE_POLICY.maximumAccuracy,
  now = Date.now(),
) {
  if (
    !Number.isFinite(fix.timestamp) ||
    now - fix.timestamp > ATTENDANCE_POLICY.maximumAge ||
    fix.timestamp > now + 5000
  )
    throw new DomainError(
      "Posisi GPS sudah usang. Ambil lokasi terbaru sebelum mengirim absensi.",
    );
  if (
    !Number.isFinite(fix.accuracy) ||
    fix.accuracy < 0 ||
    fix.accuracy > maximumAccuracy
  )
    throw new DomainError(
      "GPS belum cukup akurat. Coba di area terbuka dan ambil lokasi kembali.",
    );
}

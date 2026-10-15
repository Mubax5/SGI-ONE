export type MapPoint = { lat: number; lng: number; label: string };
export function mapSearchLink(
  point: Pick<MapPoint, "lat" | "lng"> & { label?: string },
) {
  return `https://www.openstreetmap.org/?${new URLSearchParams({ mlat: point.lat.toFixed(7), mlon: point.lng.toFixed(7) })}#map=17/${point.lat.toFixed(7)}/${point.lng.toFixed(7)}`;
}
export function mapDirectionsLink(
  origin: Pick<MapPoint, "lat" | "lng">,
  destination: Pick<MapPoint, "lat" | "lng">,
) {
  return `https://www.openstreetmap.org/directions?${new URLSearchParams({ engine: "fossgis_osrm_car", route: `${origin.lat.toFixed(7)},${origin.lng.toFixed(7)};${destination.lat.toFixed(7)},${destination.lng.toFixed(7)}` })}`;
}

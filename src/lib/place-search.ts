import type { MapPoint } from "./map-links";

export const PLACE_SEARCH_DELAY = 500;
export const PLACE_PREVIEW_LIMIT = 3;
export const PLACE_RESULT_LIMIT = 12;
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function placeTitle(point: MapPoint) {
  return point.label.split(",")[0].trim();
}
export function placeAddress(point: MapPoint) {
  return point.label.split(",").slice(1).join(",").trim();
}

/** Keep the geocoder's relevance order as a tie-breaker, after exact name matches. */
export function rankPlaces(
  query: string,
  points: MapPoint[],
  near?: Pick<MapPoint, "lat" | "lng">,
) {
  const q = normalize(query),
    terms = q.split(" ");
  const seen = new Set<string>();
  return points
    .filter((point) => {
      const key = `${point.lat.toFixed(6)}:${point.lng.toFixed(6)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((point, index) => {
      const name = normalize(placeTitle(point)),
        address = normalize(point.label);
      const relevance =
        name === q
          ? 4
          : name.startsWith(q)
            ? 3
            : terms.every((term) => name.includes(term))
              ? 2
              : terms.every((term) => address.includes(term))
                ? 1
                : 0;
      const distance = near
        ? Math.hypot(
            point.lat - near.lat,
            (point.lng - near.lng) * Math.cos((near.lat * Math.PI) / 180),
          )
        : 0;
      return { point, index, relevance, distance };
    })
    .sort(
      (a, b) =>
        b.relevance - a.relevance ||
        a.distance - b.distance ||
        a.index - b.index,
    )
    .slice(0, PLACE_RESULT_LIMIT)
    .map((item) => item.point);
}

export function matchesPlace(query: string, point: MapPoint) {
  const label = normalize(point.label);
  return normalize(query)
    .split(" ")
    .every((term) => label.includes(term));
}

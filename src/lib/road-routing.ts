import { z } from "zod";
import { DomainError } from "./domain";

export const gpsOriginInput = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
});
export const routeOptionsInput = z.object({
  preference: z.enum(["balanced", "fastest", "shortest"]).default("balanced"),
});
export type RouteOptions = z.infer<typeof routeOptionsInput>;
const coordinate = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
const routeInput = z.object({
  distance: z.number().finite().nonnegative(),
  duration: z.number().finite().nonnegative(),
  geometry: z.object({
    type: z.literal("LineString"),
    coordinates: z.array(coordinate).min(2).max(100000),
  }),
  legs: z.array(
    z.object({
      steps: z.array(
        z.object({
          name: z.string(),
          distance: z.number().finite().nonnegative(),
          duration: z.number().finite().nonnegative(),
          maneuver: z.object({
            type: z.string(),
            modifier: z.string().optional(),
            location: coordinate,
            exit: z.number().int().positive().optional(),
          }),
        }),
      ),
    }),
  ),
});
export function parseRoadRoute(
  input: unknown,
  options: Partial<RouteOptions> = {},
) {
  const settings = routeOptionsInput.parse(options);
  const response = z
    .object({
      code: z.string(),
      routes: z.array(routeInput).optional(),
      waypoints: z
        .array(z.object({ distance: z.number().finite().nonnegative() }))
        .optional(),
    })
    .safeParse(input);
  if (!response.success)
    throw new DomainError(
      "Layanan rute mengirim data yang tidak dapat dibaca. Coba lagi.",
      502,
    );
  if (response.data.code === "NoRoute" || response.data.code === "NoSegment")
    throw new DomainError(
      "Rute jalan tidak ditemukan. Periksa titik asal dan tujuan.",
      422,
    );
  const fastestTime = Math.min(
    ...(response.data.routes ?? []).map((item) => item.duration),
  );
  const alternatives = [...(response.data.routes ?? [])].sort((a, b) =>
    settings.preference === "balanced"
      ? Number(b.duration <= fastestTime * 1.15) -
          Number(a.duration <= fastestTime * 1.15) ||
        a.distance - b.distance ||
        a.duration - b.duration
      : settings.preference === "shortest"
        ? a.distance - b.distance || a.duration - b.duration
        : a.duration - b.duration || a.distance - b.distance,
  );
  const route = alternatives[0];
  if (response.data.code !== "Ok" || !route || !response.data.waypoints?.length)
    throw new DomainError(
      "Rute belum tersedia. Coba lagi setelah beberapa saat.",
      502,
    );
  // A coordinate far from the drivable network must not silently move kilometres away.
  if (response.data.waypoints.some((point) => point.distance > 1000))
    throw new DomainError(
      "Koordinat terlalu jauh dari jalan yang dapat dilalui. Perbaiki lokasi job.",
      422,
    );
  return {
    preference: settings.preference,
    alternatives: alternatives.map((item) => ({
      distanceMeters: item.distance,
      durationSeconds: item.duration,
    })),
    geometry: route.geometry,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    steps: route.legs.flatMap((leg) =>
      leg.steps.map((step) => ({
        road: step.name,
        distanceMeters: step.distance,
        durationSeconds: step.duration,
        ...step.maneuver,
      })),
    ),
    calculatedAt: new Date().toISOString(),
    attribution: "Rute berdasarkan data OpenStreetMap",
  };
}
export type RoadRoute = ReturnType<typeof parseRoadRoute>;
type Point = { lat: number; lng: number };
const cache = new Map<string, { expires: number; route: RoadRoute }>();
const pending = new Map<string, Promise<RoadRoute>>();
export async function roadRoute(
  origin: Point,
  destination: Point,
  live = false,
  options: Partial<RouteOptions> = {},
): Promise<RoadRoute> {
  const settings = routeOptionsInput.parse(options);
  const start = gpsOriginInput.parse(origin),
    end = gpsOriginInput.parse(destination);
  const base = new URL(
    process.env.ROUTING_BASE_URL || "https://router.project-osrm.org",
  );
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new DomainError(
      "Pencarian rute belum siap. Hubungi administrator.",
      503,
    );
  const coordinates = `${start.lng.toFixed(5)},${start.lat.toFixed(5)};${end.lng.toFixed(5)},${end.lat.toFixed(5)}`;
  const key = `${base.href}:${coordinates}:${settings.preference}`;
  const cached = live ? undefined : cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.route;
  if (pending.has(key)) return pending.get(key)!;
  if (pending.size >= 4)
    throw new DomainError(
      "Pencarian rute sedang sibuk. Coba kembali sebentar lagi.",
      503,
    );
  const work = (async () => {
    try {
      const url = new URL(
        `${base.href.replace(/\/$/, "")}/route/v1/driving/${coordinates}`,
      );
      url.search = new URLSearchParams({
        geometries: "geojson",
        overview: "full",
        steps: "true",
        alternatives: "true",
        radiuses: "1000;1000",
      }).toString();
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        redirect: "error",
        headers: {
          Accept: "application/json",
          "User-Agent": "SGI-One/1.0 road-routing",
        },
      });
      if (!response.ok) {
        if (response.status === 400) {
          const body: unknown = await response.json();
          if (
            typeof body === "object" &&
            body &&
            "code" in body &&
            ["InvalidOptions", "InvalidValue"].includes(String(body.code))
          )
            throw new DomainError(
              "Pilihan jalan yang dihindari belum didukung layanan rute. Ubah pilihan atau hubungi administrator.",
              422,
            );
          return parseRoadRoute(body, settings);
        }
        throw new DomainError(
          "Layanan rute tidak tersedia. Coba lagi; rute tidak akan diganti dengan garis lurus.",
          503,
        );
      }
      const route = parseRoadRoute(await response.json(), settings);
      // GPS origins are transient and are never persisted or included in shared route cache.
      if (!live) {
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(key, { expires: Date.now() + 15 * 60000, route });
      }
      return route;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError(
        "Rute gagal dimuat. Periksa koneksi dan coba lagi.",
        503,
      );
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, work);
  return work;
}

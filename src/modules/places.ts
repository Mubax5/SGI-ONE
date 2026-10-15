import { z } from "zod";
import { Actor, can, DomainError } from "@/lib/domain";
import { gpsOriginInput } from "@/lib/road-routing";
import {
  matchesPlace,
  PLACE_RESULT_LIMIT,
  rankPlaces,
} from "@/lib/place-search";
import type { MapPoint } from "@/lib/map-links";
import { mapJobs } from "./maps";

type CachedPlaces = { expires: number; points: MapPoint[] };
const cache = new Map<string, CachedPlaces>();
const pending = new Map<string, Promise<MapPoint[]>>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;
let photonUnavailableUntil = 0;
const userAgent = "SGI-One/1.0 (https://sandikaglobalindonesia.com)";

function authorize(actor: Actor) {
  if (!can(actor, "jobsWrite") && !can(actor, "users"))
    throw new DomainError("Anda tidak memiliki izin memilih lokasi.", 403);
}

const photonInput = z.object({
  features: z
    .array(
      z.object({
        geometry: z.object({
          type: z.literal("Point"),
          coordinates: z.tuple([
            z.number().finite().min(-180).max(180),
            z.number().finite().min(-90).max(90),
          ]),
        }),
        properties: z.record(z.string(), z.unknown()),
      }),
    )
    .max(20),
});
const nominatimPoint = z.object({
  lat: z
    .union([z.number().finite(), z.string().trim().min(1)])
    .transform(Number)
    .pipe(z.number().finite().min(-90).max(90)),
  lon: z
    .union([z.number().finite(), z.string().trim().min(1)])
    .transform(Number)
    .pipe(z.number().finite().min(-180).max(180)),
  display_name: z.string().min(1).max(2000),
});

function endpoint(baseValue: string, path: string, params: URLSearchParams) {
  const base = new URL(baseValue);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new DomainError(
      "Pencarian lokasi belum siap. Hubungi administrator.",
      503,
    );
  const url = new URL(
    path,
    base.href.endsWith("/") ? base.href : `${base.href}/`,
  );
  url.search = params.toString();
  return url;
}

/** One shared queue and cache; Nominatim is called only for explicit search or pin selection. */
async function lookup(
  url: URL,
  provider: "photon" | "nominatim",
  reverse = false,
) {
  const key = url.href,
    saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return saved.points;
  if (pending.has(key)) return pending.get(key)!;
  if (pending.size >= 8)
    throw new DomainError("Pencarian sedang sibuk. Coba lagi sebentar.", 429);
  const task = queue
    .catch(() => undefined)
    .then(async () => {
      const wait = Math.max(0, lastRequest + 1100 - Date.now());
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequest = Date.now();
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": userAgent, Accept: "application/json" },
          signal: AbortSignal.timeout(provider === "photon" ? 4500 : 10000),
          redirect: "error",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Geocoding request failed");
        const json = await response.json();
        const points: MapPoint[] =
          provider === "photon"
            ? photonInput.parse(json).features.map((feature) => {
                const p = feature.properties,
                  part = (name: string) =>
                    typeof p[name] === "string" ? (p[name] as string) : "";
                const label = [
                  ...new Set(
                    [
                      part("name"),
                      [part("street"), part("housenumber")]
                        .filter(Boolean)
                        .join(" "),
                      part("district"),
                      part("city"),
                      part("state"),
                      part("country"),
                    ].filter(Boolean),
                  ),
                ]
                  .join(", ")
                  .slice(0, 500);
                return {
                  lat: feature.geometry.coordinates[1],
                  lng: feature.geometry.coordinates[0],
                  label: label || "Titik OpenStreetMap",
                };
              })
            : (reverse
                ? [nominatimPoint.parse(json)]
                : z.array(nominatimPoint).max(20).parse(json)
              ).map((point) => ({
                lat: point.lat,
                lng: point.lon,
                label: point.display_name.slice(0, 500),
              }));
        if (cache.size >= 300) cache.delete(cache.keys().next().value!);
        cache.set(key, { expires: Date.now() + 3600000, points });
        return points;
      } catch {
        if (provider === "photon") photonUnavailableUntil = Date.now() + 60000;
        throw new DomainError(
          "Alamat belum dapat dicari. Coba lagi atau pilih titik pada peta.",
          502,
        );
      }
    })
    .finally(() => pending.delete(key));
  pending.set(key, task);
  queue = task;
  return task;
}

export async function searchPlaces(
  actor: Actor,
  query: unknown,
  options: {
    mode?: string | null;
    lat?: string | null;
    lng?: string | null;
  } = {},
) {
  authorize(actor);
  const q = z
    .string()
    .trim()
    .min(3, "Tulis minimal 3 karakter.")
    .max(180)
    .parse(query);
  const mode = z.enum(["suggest", "search"]).parse(options.mode ?? "suggest");
  if (
    (options.lat != null || options.lng != null) &&
    (!options.lat?.trim() || !options.lng?.trim())
  )
    throw new DomainError("Latitude dan longitude harus diisi bersama.");
  const near =
    options.lat != null || options.lng != null
      ? gpsOriginInput.parse({ lat: options.lat, lng: options.lng })
      : undefined;
  const local = can(actor, "jobsRead")
    ? (await mapJobs(actor)).rows
        .flatMap((row) =>
          row.location
            ? [
                {
                  lat: row.location.originLat,
                  lng: row.location.originLng,
                  label: row.location.originLabel || row.origin,
                },
                {
                  lat: row.location.destinationLat,
                  lng: row.location.destinationLng,
                  label: row.location.destinationLabel || row.destination,
                },
              ]
            : [],
        )
        .filter((point) => matchesPlace(q, point))
    : [];
  const saved = [...cache.values()]
    .filter((entry) => entry.expires > Date.now())
    .flatMap((entry) => entry.points)
    .filter((point) => matchesPlace(q, point));
  if (mode === "suggest" && (local.length || saved.length))
    return {
      rows: rankPlaces(q, [...local, ...saved], near),
      unavailable: false,
    };
  if (mode === "search") {
    const url = endpoint(
      process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org/",
      "search",
      new URLSearchParams({
        q,
        format: "jsonv2",
        limit: String(PLACE_RESULT_LIMIT),
        countrycodes: "id",
      }),
    );
    return {
      rows: rankPlaces(
        q,
        [...local, ...(await lookup(url, "nominatim"))],
        near,
      ),
      unavailable: false,
    };
  }
  if (photonUnavailableUntil > Date.now())
    return { rows: local, unavailable: true };
  const params = new URLSearchParams({
    q,
    limit: String(PLACE_RESULT_LIMIT),
    countrycode: "ID",
  });
  if (near) {
    params.set("lat", String(near.lat));
    params.set("lon", String(near.lng));
  }
  try {
    const rows = await lookup(
      endpoint(
        process.env.GEOCODING_BASE_URL || "https://photon.komoot.io/",
        "api/",
        params,
      ),
      "photon",
    );
    return {
      rows: rankPlaces(q, [...local, ...rows], near),
      unavailable: false,
    };
  } catch {
    return { rows: local, unavailable: true };
  }
}

export async function reversePlace(actor: Actor, input: unknown) {
  authorize(actor);
  const { lat, lng } = gpsOriginInput.parse(input);
  const url = endpoint(
    process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org/",
    "reverse",
    new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "jsonv2",
    }),
  );
  const rows = await lookup(url, "nominatim", true);
  return { lat, lng, label: rows[0]?.label ?? "Titik dipilih pada peta" };
}

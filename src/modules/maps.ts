import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobLocations, jobs } from "@/db/schema";
import { Actor, DomainError } from "@/lib/domain";
import { requireJob } from "@/lib/security";
import { scopedJobs } from "./queries";
import { log } from "./services";
import { gpsOriginInput, roadRoute } from "@/lib/road-routing";
export const locationInput = z
  .object({
    originLat: z.number().finite().min(-90).max(90),
    originLng: z.number().finite().min(-180).max(180),
    destinationLat: z.number().finite().min(-90).max(90),
    destinationLng: z.number().finite().min(-180).max(180),
    originLabel: z.string().trim().min(1).max(500).nullable().optional(),
    destinationLabel: z.string().trim().min(1).max(500).nullable().optional(),
  })
  .strict();
export async function mapJobs(actor: Actor) {
  const rows = await scopedJobs(actor);
  const points = rows.length
    ? await db
        .select()
        .from(jobLocations)
        .where(
          inArray(
            jobLocations.jobId,
            rows.map((j) => j.id),
          ),
        )
    : [];
  return {
    rows: rows.map(
      ({ id, number, origin, destination, status, customerName }) => ({
        id,
        number,
        origin,
        destination,
        status,
        customerName,
        location: points.find((p) => p.jobId === id) ?? null,
      }),
    ),
  };
}
export async function saveLocation(actor: Actor, id: string, input: unknown) {
  await requireJob(actor, id, "jobsWrite");
  const parsed = locationInput.parse(input);
  const value = {
    ...parsed,
    originLabel: parsed.originLabel ?? null,
    destinationLabel: parsed.destinationLabel ?? null,
  };
  return db.transaction(async (tx) => {
    await tx.select().from(jobs).where(eq(jobs.id, id)).for("update");
    const job = await requireJob(actor, id, "jobsWrite", tx);
    if (job.status === "cancelled")
      throw new DomainError("Job dibatalkan. Lokasi tidak dapat diperbarui.");
    const [before] = await tx
      .select()
      .from(jobLocations)
      .where(eq(jobLocations.jobId, id));
    const [after] = await tx
      .insert(jobLocations)
      .values({ jobId: id, ...value, updatedBy: actor.id })
      .onConflictDoUpdate({
        target: jobLocations.jobId,
        set: { ...value, updatedBy: actor.id, updatedAt: new Date() },
      })
      .returning();
    await log(tx, actor, "job", id, "location_updated", before, after);
    return after;
  });
}
export type MapData = Awaited<ReturnType<typeof mapJobs>>;
export async function jobRoadRoute(actor: Actor, id: string, origin?: unknown) {
  await requireJob(actor, id, "jobsRead");
  const [location] = await db
    .select()
    .from(jobLocations)
    .where(eq(jobLocations.jobId, id));
  if (!location)
    throw new DomainError(
      "Pilih asal dan tujuan job sebelum mencari rute.",
      422,
    );
  const start =
    origin === undefined
      ? { lat: location.originLat, lng: location.originLng }
      : gpsOriginInput.parse(origin);
  return roadRoute(
    start,
    { lat: location.destinationLat, lng: location.destinationLng },
    origin !== undefined,
    { preference: "balanced" },
  );
}

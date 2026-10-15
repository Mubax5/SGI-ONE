import { and, desc, eq, inArray, isNull, notInArray, lt } from "drizzle-orm";
import { z } from "zod";
import sharp from "sharp";
import { db, type Transaction } from "@/db";
import * as s from "@/db/schema";
import { Actor, can, DomainError, requirePermission } from "@/lib/domain";
import {
  ATTENDANCE_POLICY,
  checkAttendanceFix,
  checkAttendanceSample,
  type AttendanceTarget,
} from "@/lib/attendance-policy";
import { deleteFile, getFile, putFile, validateFile } from "@/lib/storage";
import { log } from "./services";
export const attendanceSiteInput = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(3).max(100),
    label: z.string().trim().min(1).max(500),
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
    radius: z.number().int().min(50).max(2000),
    active: z.boolean().default(true),
  })
  .strict();
export async function saveAttendanceSite(actor: Actor, input: unknown) {
  requirePermission(actor, "users");
  const { id, ...data } = attendanceSiteInput.parse(input);
  return db.transaction(async (tx) => {
    let before;
    if (id) {
      [before] = await tx
        .select()
        .from(s.attendanceSites)
        .where(eq(s.attendanceSites.id, id))
        .for("update");
      if (!before)
        throw new DomainError("Lokasi absensi tidak ditemukan.", 404);
    }
    const [after] = id
      ? await tx
          .update(s.attendanceSites)
          .set({ ...data, updatedBy: actor.id, updatedAt: new Date() })
          .where(eq(s.attendanceSites.id, id))
          .returning()
      : await tx
          .insert(s.attendanceSites)
          .values({ ...data, updatedBy: actor.id })
          .returning();
    await log(
      tx,
      actor,
      "attendance_site",
      after.id,
      id ? "update" : "create",
      before,
      after,
    );
    return after;
  });
}
export async function attendanceTargets(
  actor: Actor,
  connection: typeof db | Transaction = db,
): Promise<AttendanceTarget[]> {
  const sites = await connection
    .select()
    .from(s.attendanceSites)
    .where(eq(s.attendanceSites.active, true));
  const assigned = can(actor, "jobsRead")
    ? await connection
        .select({ job: s.jobs, location: s.jobLocations })
        .from(s.assignments)
        .innerJoin(s.jobs, eq(s.jobs.id, s.assignments.jobId))
        .innerJoin(s.jobLocations, eq(s.jobLocations.jobId, s.jobs.id))
        .where(
          and(
            eq(s.assignments.userId, actor.id),
            notInArray(s.jobs.status, ["cancelled", "draft"]),
          ),
        )
    : [];
  return [
    ...sites.map((site) => ({
      key: `site:${site.id}`,
      label: site.name,
      placeLabel: site.label,
      lat: site.lat,
      lng: site.lng,
      radius: site.radius,
    })),
    ...assigned.flatMap(({ job, location }) => [
      {
        key: `job:${job.id}:origin`,
        label: `${job.number} · Asal: ${job.origin}`,
        placeLabel: location.originLabel || job.origin,
        lat: location.originLat,
        lng: location.originLng,
        radius: ATTENDANCE_POLICY.jobRadius,
      },
      {
        key: `job:${job.id}:destination`,
        label: `${job.number} · Tujuan: ${job.destination}`,
        placeLabel: location.destinationLabel || job.destination,
        lat: location.destinationLat,
        lng: location.destinationLng,
        radius: ATTENDANCE_POLICY.jobRadius,
      },
    ]),
  ];
}
export async function attendanceHistory(actor: Actor) {
  requirePermission(actor, "attendanceSelf");
  const rows = await db
    .select()
    .from(s.attendance)
    .where(eq(s.attendance.userId, actor.id))
    .orderBy(desc(s.attendance.checkIn))
    .limit(100);
  const evidence = rows.length
    ? await db
        .select({
          id: s.attendanceEvidence.id,
          attendanceId: s.attendanceEvidence.attendanceId,
          kind: s.attendanceEvidence.kind,
          target: s.attendanceEvidence.target,
          accuracy: s.attendanceEvidence.accuracy,
          distance: s.attendanceEvidence.distance,
          lat: s.attendanceEvidence.lat,
          lng: s.attendanceEvidence.lng,
          sampledAt: s.attendanceEvidence.sampledAt,
        })
        .from(s.attendanceEvidence)
        .where(
          inArray(
            s.attendanceEvidence.attendanceId,
            rows.map((r) => r.id),
          ),
        )
    : [];
  return {
    rows: rows.map((row) => ({
      ...row,
      evidence: evidence.filter((e) => e.attendanceId === row.id),
    })),
    targets: await attendanceTargets(actor),
    sites: can(actor, "users")
      ? await db
          .select()
          .from(s.attendanceSites)
          .orderBy(s.attendanceSites.name)
      : [],
    policy: ATTENDANCE_POLICY,
  };
}
const inputSchema = z
  .object({
    kind: z.enum(["in", "out"]),
    workMode: z.enum(["onsite", "wfh", "visit"]).default("onsite"),
    cameraToken: z.string().uuid(),
    capturedAt: z.number().finite(),
    targetKey: z.string().min(5).max(100),
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
    accuracy: z
      .number()
      .finite()
      .min(0)
      .max(ATTENDANCE_POLICY.maximumRemoteAccuracy),
    timestamp: z.number().finite(),
    note: z.string().trim().max(500).default(""),
  })
  .strict();
export async function submitAttendance(actor: Actor, form: FormData) {
  requirePermission(actor, "attendanceSelf");
  const raw = form.get("data");
  if (typeof raw !== "string")
    throw new DomainError("Kirim lokasi GPS dan foto untuk absensi.");
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new DomainError("Data absensi tidak valid.");
  }
  const data = inputSchema.parse(input),
    file = form.get("photo");
  const permitted = await attendanceTargets(actor);
  const target =
    data.workMode === "onsite"
      ? permitted.find((t) => t.key === data.targetKey)
      : {
          key: data.targetKey,
          label: data.workMode === "wfh" ? "WFH" : "Kunjungan lapangan",
          lat: data.lat,
          lng: data.lng,
          radius: 200,
        };
  if (data.workMode !== "onsite" && data.note.length < 10)
    throw new DomainError(
      "Tuliskan rencana atau hasil kerja, minimal 10 karakter.",
    );
  if (
    data.workMode === "visit" &&
    actor.roles.includes("field") &&
    !permitted.some((t) => t.key === data.targetKey && t.key.startsWith("job:"))
  )
    throw new DomainError(
      "Pilih job yang ditugaskan untuk absensi lapangan.",
      403,
    );
  if (
    data.capturedAt < Date.now() - 60000 ||
    data.capturedAt > Date.now() + 5000
  )
    throw new DomainError("Foto sudah usang. Ambil foto baru.");
  if (!target)
    throw new DomainError(
      "Lokasi absensi tidak tersedia untuk akun Anda. Muat ulang halaman.",
      403,
    );
  if (data.workMode === "onsite") checkAttendanceFix(data, target);
  else checkAttendanceSample(data, ATTENDANCE_POLICY.maximumRemoteAccuracy);
  if (
    !(file instanceof File) ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > ATTENDANCE_POLICY.maximumPhotoBytes
  )
    throw new DomainError(
      "Ambil foto absensi JPG, PNG atau WebP, maksimal 5 MB.",
    );
  const inputBytes = new Uint8Array(await file.arrayBuffer());
  validateFile(file.name, file.type, inputBytes);
  let bytes: Uint8Array;
  try {
    const image = sharp(inputBytes, {
      failOn: "warning",
      limitInputPixels: 20000000,
    });
    const metadata = await image.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width < 64 ||
      metadata.height < 64 ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error("Invalid image dimensions");
    // Decode genuine pixels and strip EXIF/private metadata before private storage.
    bytes = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new DomainError(
      "Foto tidak dapat dibaca. Ambil foto JPG, PNG atau WebP yang utuh (minimal 64×64 px).",
    );
  }
  const key = `attendance/${actor.id}/${crypto.randomUUID()}.jpg`;
  await putFile(key, "image/jpeg", bytes);
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(s.user)
        .where(eq(s.user.id, actor.id))
        .for("update");
      if (!user?.active) throw new DomainError("Akun tidak aktif.", 403);
      const [camera] = await tx
        .select()
        .from(s.attendanceCameraTokens)
        .where(
          and(
            eq(s.attendanceCameraTokens.id, data.cameraToken),
            eq(s.attendanceCameraTokens.userId, actor.id),
          ),
        )
        .for("update");
      if (
        !camera ||
        camera.usedAt ||
        camera.expiresAt.getTime() < Date.now() ||
        data.capturedAt < camera.createdAt.getTime() - 5000
      )
        throw new DomainError("Sesi kamera berakhir. Ambil foto baru.", 422);
      await tx
        .update(s.attendanceCameraTokens)
        .set({ usedAt: new Date() })
        .where(eq(s.attendanceCameraTokens.id, camera.id));
      const [kind, placeId] = data.targetKey.split(":");
      if (data.workMode === "onsite" && kind === "site")
        await tx
          .select()
          .from(s.attendanceSites)
          .where(eq(s.attendanceSites.id, placeId))
          .for("share");
      else if (data.workMode !== "wfh" && kind === "job")
        await tx
          .select()
          .from(s.jobs)
          .where(eq(s.jobs.id, placeId))
          .for("share");
      const current =
        data.workMode === "onsite"
          ? (await attendanceTargets(actor, tx)).find(
              (t) => t.key === data.targetKey,
            )
          : target;
      if (
        data.workMode === "visit" &&
        actor.roles.includes("field") &&
        !(await attendanceTargets(actor, tx)).some(
          (t) => t.key === data.targetKey,
        )
      )
        throw new DomainError(
          "Penugasan berubah. Pilih job yang ditugaskan.",
          403,
        );
      if (!current)
        throw new DomainError(
          "Lokasi/penugasan berubah. Muat ulang halaman sebelum absen.",
          403,
        );
      const [open] = await tx
        .select()
        .from(s.attendance)
        .where(
          and(eq(s.attendance.userId, actor.id), isNull(s.attendance.checkOut)),
        )
        .for("update");
      if (data.kind === "in" && open)
        throw new DomainError(
          "Anda sudah check-in. Check-out terlebih dahulu.",
          409,
        );
      if (data.kind === "out" && !open)
        throw new DomainError("Belum ada check-in aktif.", 409);
      if (data.kind === "out" && open!.workMode !== data.workMode)
        throw new DomainError("Gunakan mode kerja yang sama dengan check-in.");
      const distance =
        data.workMode === "onsite" ? checkAttendanceFix(data, current) : 0;
      if (data.workMode !== "onsite")
        checkAttendanceSample(data, ATTENDANCE_POLICY.maximumRemoteAccuracy);
      const [row] =
        data.kind === "in"
          ? await tx
              .insert(s.attendance)
              .values({
                userId: actor.id,
                note: data.note,
                workMode: data.workMode,
                reviewStatus:
                  data.workMode === "onsite" ? "validated" : "pending",
              })
              .returning()
          : await tx
              .update(s.attendance)
              .set({
                checkOut: new Date(),
                note: [open!.note, data.note].filter(Boolean).join(" · "),
                reviewStatus:
                  data.workMode === "onsite" ? "validated" : "pending",
                reviewedBy: null,
                reviewedAt: null,
                reviewNote: null,
              })
              .where(eq(s.attendance.id, open!.id))
              .returning();
      const [proof] = await tx
        .insert(s.attendanceEvidence)
        .values({
          attendanceId: row.id,
          kind: data.kind,
          targetKey: current.key,
          target: {
            ...current,
            radius: data.workMode === "onsite" ? current.radius : 0,
          },
          lat: data.lat,
          lng: data.lng,
          accuracy: data.accuracy,
          distance,
          sampledAt: new Date(data.timestamp),
          capturedAt: new Date(data.capturedAt),
          storageKey: key,
          mimeType: "image/jpeg",
          size: bytes.length,
        })
        .returning();
      await log(
        tx,
        actor,
        "attendance",
        row.id,
        data.kind === "in" ? "check_in" : "check_out",
        null,
        {
          target: current.label,
          evidenceId: proof.id,
          validated: data.workMode === "onsite",
          workMode: data.workMode,
          capturedAt: new Date(data.capturedAt).toISOString(),
          distance: Math.round(distance),
          accuracy: data.accuracy,
        },
      );
      return {
        id: row.id,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        validated: data.workMode === "onsite",
      };
    });
  } catch (error) {
    await deleteFile(key).catch(() =>
      console.error(
        "Attendance photo cleanup failed; reconciliation required.",
      ),
    );
    throw error;
  }
}
export async function attendancePhoto(actor: Actor, id: string) {
  requirePermission(actor, "attendanceSelf");
  const [proof] = await db
    .select({ e: s.attendanceEvidence, userId: s.attendance.userId })
    .from(s.attendanceEvidence)
    .innerJoin(
      s.attendance,
      eq(s.attendance.id, s.attendanceEvidence.attendanceId),
    )
    .where(eq(s.attendanceEvidence.id, id));
  if (
    !proof ||
    (proof.userId !== actor.id &&
      !(await monitoredUserIds(actor)).includes(proof.userId))
  )
    throw new DomainError("Bukti absensi tidak ditemukan.", 404);
  const bytes = await getFile(proof.e.storageKey);
  await db.transaction((tx) =>
    log(tx, actor, "attendance", proof.e.attendanceId, "photo_view", null, {
      evidenceId: id,
    }),
  );
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": proof.e.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
export async function issueAttendanceCameraToken(actor: Actor) {
  requirePermission(actor, "attendanceSelf");
  await db
    .delete(s.attendanceCameraTokens)
    .where(
      lt(s.attendanceCameraTokens.expiresAt, new Date(Date.now() - 3600000)),
    );
  const [token] = await db
    .insert(s.attendanceCameraTokens)
    .values({ userId: actor.id, expiresAt: new Date(Date.now() + 120000) })
    .returning();
  return { id: token.id, expiresAt: token.expiresAt };
}
async function monitoredUserIds(actor: Actor): Promise<string[]> {
  if (!can(actor, "attendanceMonitor")) return [];
  if (actor.roles.includes("director"))
    return (await db.select({ id: s.user.id }).from(s.user)).map((r) => r.id);
  return (
    await db
      .select({ id: s.userRoles.userId })
      .from(s.userRoles)
      .where(eq(s.userRoles.role, "field"))
  ).map((r) => r.id);
}
export async function attendanceMonitoring(actor: Actor) {
  requirePermission(actor, "attendanceMonitor");
  const ids = await monitoredUserIds(actor);
  if (!ids.length) return { rows: [] };
  const rows = await db
    .select({ record: s.attendance, name: s.user.name })
    .from(s.attendance)
    .innerJoin(s.user, eq(s.user.id, s.attendance.userId))
    .where(inArray(s.attendance.userId, ids))
    .orderBy(desc(s.attendance.checkIn))
    .limit(200);
  const evidence = rows.length
    ? await db
        .select({
          id: s.attendanceEvidence.id,
          attendanceId: s.attendanceEvidence.attendanceId,
          kind: s.attendanceEvidence.kind,
          target: s.attendanceEvidence.target,
          lat: s.attendanceEvidence.lat,
          lng: s.attendanceEvidence.lng,
          accuracy: s.attendanceEvidence.accuracy,
          distance: s.attendanceEvidence.distance,
        })
        .from(s.attendanceEvidence)
        .where(
          inArray(
            s.attendanceEvidence.attendanceId,
            rows.map((r) => r.record.id),
          ),
        )
    : [];
  return {
    rows: rows.map(({ record, name }) => ({
      ...record,
      name,
      evidence: evidence.filter((e) => e.attendanceId === record.id),
    })),
  };
}
export async function reviewAttendance(
  actor: Actor,
  id: string,
  input: unknown,
) {
  requirePermission(actor, "attendanceMonitor");
  const decision = z
    .object({
      status: z.enum(["approved", "rejected"]),
      note: z.string().trim().min(5).max(500),
    })
    .strict()
    .parse(input);
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(s.attendance)
      .where(eq(s.attendance.id, id))
      .for("update");
    if (!before || !(await monitoredUserIds(actor)).includes(before.userId))
      throw new DomainError("Absensi tidak ditemukan.", 404);
    if (before.userId === actor.id)
      throw new DomainError(
        "Absensi sendiri harus diperiksa atasan lain.",
        403,
      );
    if (before.reviewStatus !== "pending")
      throw new DomainError("Absensi ini tidak menunggu review.", 409);
    const [after] = await tx
      .update(s.attendance)
      .set({
        reviewStatus: decision.status,
        reviewNote: decision.note,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
      })
      .where(eq(s.attendance.id, id))
      .returning();
    await log(tx, actor, "attendance", id, "review", before, after);
    return after;
  });
}

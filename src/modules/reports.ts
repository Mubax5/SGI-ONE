import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { Actor, DomainError, requirePermission } from "@/lib/domain";
import { requireJob } from "@/lib/security";
import {
  allowedFiles,
  deleteFile,
  getFile,
  putFile,
  validateFile,
} from "@/lib/storage";
import { scopedJobs } from "./queries";
import { log } from "./services";

export async function reports(actor: Actor) {
  requirePermission(actor, "reportsRead");
  const jobs = await scopedJobs(actor);
  if (!jobs.length) return { rows: [], jobs };
  const rows = await db
    .select({ report: s.workReports, actorName: s.user.name })
    .from(s.workReports)
    .innerJoin(s.user, eq(s.user.id, s.workReports.actorId))
    .where(
      inArray(
        s.workReports.jobId,
        jobs.map((j) => j.id),
      ),
    )
    .orderBy(desc(s.workReports.createdAt))
    .limit(200);
  return {
    jobs,
    rows: rows.map(({ report, actorName }) => {
      const { storageKey, ...publicReport } = report;
      const job = jobs.find((j) => j.id === report.jobId)!;
      return {
        ...publicReport,
        actorName,
        hasPhoto: Boolean(storageKey),
        jobNumber: job.number,
        customerName: job.customerName,
      };
    }),
  };
}

export async function createReport(
  actor: Actor,
  jobId: string,
  form: FormData,
) {
  const job = await requireJob(actor, jobId, "jobsProgress");
  if (["cancelled", "completed"].includes(job.status))
    throw new DomainError(
      "Job sudah ditutup. Pilih pekerjaan yang masih aktif.",
    );
  const note = z
    .string()
    .trim()
    .min(5, "Tulis minimal 5 karakter untuk menjelaskan pekerjaan.")
    .max(2000)
    .parse(form.get("note"));
  const file = form.get("photo");
  let photo:
    | { storageKey: string; filename: string; mimeType: string; size: number }
    | undefined;
  if (file instanceof File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new DomainError(
        "Gunakan foto JPG, PNG, atau WebP, maksimal 10 MB.",
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    validateFile(file.name, file.type, bytes);
    const storageKey = `reports/${jobId}/${crypto.randomUUID()}${allowedFiles[file.type]}`;
    await putFile(storageKey, file.type, bytes);
    photo = {
      storageKey,
      filename: file.name,
      mimeType: file.type,
      size: bytes.length,
    };
  } else if (file !== null) {
    throw new DomainError("Lampiran foto tidak valid.");
  }
  try {
    return await db.transaction(async (tx) => {
      await tx.select().from(s.jobs).where(eq(s.jobs.id, jobId)).for("update");
      const current = await requireJob(actor, jobId, "jobsProgress", tx);
      if (["cancelled", "completed"].includes(current.status))
        throw new DomainError(
          "Job sudah ditutup. Muat ulang daftar pekerjaan.",
        );
      const [progress] = await tx
        .insert(s.progress)
        .values({ jobId, actorId: actor.id, note })
        .returning();
      const [report] = await tx
        .insert(s.workReports)
        .values({
          jobId,
          progressId: progress.id,
          actorId: actor.id,
          note,
          ...photo,
        })
        .returning();
      await log(tx, actor, "report", report.id, "create", null, {
        jobId,
        progressId: progress.id,
        note,
        filename: photo?.filename ?? null,
      });
      const { storageKey, ...publicReport } = report;
      return { ...publicReport, hasPhoto: Boolean(storageKey) };
    });
  } catch (error) {
    if (photo)
      await deleteFile(photo.storageKey).catch(() =>
        console.error("Report photo cleanup failed; reconciliation required."),
      );
    throw error;
  }
}
export async function reportPhoto(actor: Actor, id: string) {
  requirePermission(actor, "reportsRead");
  const [report] = await db
    .select()
    .from(s.workReports)
    .where(eq(s.workReports.id, id));
  if (!report) throw new DomainError("Laporan tidak ditemukan.", 404);
  await requireJob(actor, report.jobId, "documentsRead");
  if (!report.storageKey || !report.mimeType)
    throw new DomainError("Laporan tidak memiliki foto.", 404);
  const bytes = await getFile(report.storageKey);
  await db.transaction(async (tx) => {
    await requireJob(actor, report.jobId, "documentsRead", tx);
    await log(tx, actor, "report", id, "photo_view");
  });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": report.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

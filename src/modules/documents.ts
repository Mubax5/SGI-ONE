import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { Actor, documentTypes, DomainError } from "@/lib/domain";
import { requireJob } from "@/lib/security";
import {
  allowedFiles,
  deleteFile,
  getFile,
  putFile,
  validateFile,
} from "@/lib/storage";
import { log } from "./services";
export async function uploadDocument(
  actor: Actor,
  jobId: string,
  form: FormData,
) {
  await requireJob(actor, jobId, "documentsUpload");
  const file = form.get("file");
  const type = String(form.get("type"));
  if (!(file instanceof File) || !Object.hasOwn(documentTypes, type))
    throw new DomainError("Pilih file dan jenis dokumen yang valid.");
  if (file.size > 10 * 1024 * 1024)
    throw new DomainError("Ukuran file maksimal 10 MB.");
  const data = new Uint8Array(await file.arrayBuffer());
  validateFile(file.name, file.type, data);
  const key = `jobs/${jobId}/${crypto.randomUUID()}${allowedFiles[file.type]}`;
  await putFile(key, file.type, data);
  try {
    return await db.transaction(async (tx) => {
      await tx.select().from(s.jobs).where(eq(s.jobs.id, jobId)).for("update");
      const job = await requireJob(actor, jobId, "documentsUpload", tx);
      if (job.status === "cancelled") throw new DomainError("Job dibatalkan.");
      const [latest] = await tx
        .select()
        .from(s.documents)
        .where(and(eq(s.documents.jobId, jobId), eq(s.documents.type, type)))
        .orderBy(desc(s.documents.version))
        .limit(1);
      const [row] = await tx
        .insert(s.documents)
        .values({
          jobId,
          type,
          storageKey: key,
          filename: file.name,
          mimeType: file.type,
          size: data.length,
          version: (latest?.version ?? 0) + 1,
          supersedesId: latest?.id,
          uploadedBy: actor.id,
        })
        .returning();
      await log(tx, actor, "document", row.id, "upload", null, {
        jobId,
        type,
        filename: row.filename,
        version: row.version,
      });
      return { id: row.id, status: row.status, version: row.version };
    });
  } catch (e) {
    try {
      await deleteFile(key);
    } catch {
      console.error("R2 cleanup failed; orphan object", key);
    }
    throw e;
  }
}
export async function downloadDocument(actor: Actor, id: string) {
  const [doc] = await db
    .select()
    .from(s.documents)
    .where(eq(s.documents.id, id));
  if (!doc) throw new DomainError("Dokumen tidak ditemukan.", 404);
  await requireJob(actor, doc.jobId, "documentsRead");
  const bytes = await getFile(doc.storageKey);
  await db.transaction(async (tx) => {
    await requireJob(actor, doc.jobId, "documentsRead", tx);
    await log(tx, actor, "document", id, "download");
  });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `attachment; filename="document${allowedFiles[doc.mimeType]}"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

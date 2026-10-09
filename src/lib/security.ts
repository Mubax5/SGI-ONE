import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { user, userRoles, assignments, jobs } from "@/db/schema";
import { auth } from "./auth";
import {
  Actor,
  can,
  DomainError,
  Permission,
  requirePermission,
} from "./domain";
export async function getActor(requestHeaders?: Headers): Promise<Actor> {
  const result = await auth.api.getSession({
    headers: requestHeaders ?? (await headers()),
  });
  if (!result)
    throw new DomainError("Sesi telah berakhir. Silakan masuk kembali.", 401);
  const [profile] = await db
    .select()
    .from(user)
    .where(eq(user.id, result.user.id));
  if (!profile?.active)
    throw new DomainError("Akun dinonaktifkan. Hubungi administrator.", 403);
  const roleRows = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, profile.id));
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    roles: roleRows.map((r) => r.role),
  };
}
export async function requireJob(
  actor: Actor,
  jobId: string,
  permission: Permission,
  tx: typeof db | import("@/db").Transaction = db,
) {
  requirePermission(actor, permission);
  const [job] = await tx.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new DomainError("Job tidak ditemukan.", 404);
  const broader = actor.roles.some((r) =>
    ["director", "operations", "finance"].includes(r),
  );
  if (!broader) {
    const [assignment] = await tx
      .select()
      .from(assignments)
      .where(
        and(eq(assignments.jobId, jobId), eq(assignments.userId, actor.id)),
      );
    if (!assignment)
      throw new DomainError(
        "Job tidak ditemukan atau belum ditugaskan kepada Anda.",
        404,
      );
  }
  if (
    (permission === "jobsProgress" || permission === "documentsUpload") &&
    !can(actor, "jobsWrite")
  ) {
    const [assignment] = await tx
      .select()
      .from(assignments)
      .where(
        and(eq(assignments.jobId, jobId), eq(assignments.userId, actor.id)),
      );
    if (!assignment)
      throw new DomainError("Anda belum ditugaskan pada job ini.", 403);
  }
  return job;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(
    process.env.BETTER_AUTH_URL ?? "http://localhost:4310",
  ).origin;
  if (origin !== expected)
    throw new DomainError(
      "Permintaan harus berasal dari aplikasi SGI One.",
      403,
    );
}

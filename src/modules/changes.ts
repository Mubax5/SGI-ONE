import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { Actor, can } from "@/lib/domain";
export async function changeCursor(actor: Actor) {
  const field = actor.roles.includes("field");
  const scope = field
    ? sql`(actor_id = ${actor.id} or (entity = 'job' and entity_id in (select job_id from job_assignments where user_id = ${actor.id})) or (entity = 'document' and entity_id in (select d.id from documents d join job_assignments a on a.job_id = d.job_id where a.user_id = ${actor.id})) or (entity = 'report' and entity_id in (select r.id from work_reports r join job_assignments a on a.job_id = r.job_id where a.user_id = ${actor.id})))`
    : can(actor, "audit")
      ? sql`true`
      : sql`entity in (${sql.join(
          (actor.roles.includes("finance")
            ? [
                "invoice",
                "payment",
                "billable",
                "quotation",
                "job",
                "document",
                "customer",
              ]
            : actor.roles.includes("sales")
              ? ["customer", "request", "quotation"]
              : [
                  "customer",
                  "job",
                  "document",
                  "billable",
                  "quotation",
                  "request",
                  "report",
                ]
          ).map((entity) => sql`${entity}`),
          sql`, `,
        )}) or actor_id = ${actor.id}`;
  const result = await db.execute(
    sql`select count(*)::text as count, max(created_at)::text as latest from audit_logs where ${scope}`,
  );
  const sessions = await db.execute(
    sql`select count(*)::text as count from sessions where expires_at > now() and ${actor.roles.includes("admin") ? sql`true` : sql`user_id = ${actor.id}`}`,
  );
  return {
    version: createHash("sha256")
      .update(
        JSON.stringify([
          result.rows[0],
          sessions.rows[0],
          process.pid,
          Math.floor(Date.now() / 60000),
        ]),
      )
      .digest("hex"),
  };
}

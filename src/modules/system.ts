import { sql } from "drizzle-orm";
import { db } from "@/db";
import { user, userRoles } from "@/db/schema";
import { Actor, requirePermission, roleKeys } from "@/lib/domain";
import { storageConfigured, probeStorage } from "@/lib/storage";
export async function systemHealth(actor: Actor, probe = false) {
  requirePermission(actor, "users");
  const started = performance.now();
  const result = await db.execute(sql`select
    (select count(*)::int from sessions where expires_at > now()) as sessions,
    (select count(*)::int from pg_stat_activity where datname = current_database()) as connections,
    (select count(*)::int from audit_logs where created_at >= now() - interval '24 hours') as events,
    (select count(*)::int from documents) as documents,
    (select count(*)::int from work_reports where storage_key is not null) as photos,
    coalesce((select sum(size)::bigint from documents),0) + coalesce((select sum(size)::bigint from work_reports),0) as bytes`);
  const row = result.rows[0];
  const [people, roles, access] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        active: user.active,
      })
      .from(user)
      .orderBy(user.name),
    db.select().from(userRoles),
    db.execute(
      sql`select count(distinct s.user_id)::int as users from sessions s join users u on u.id = s.user_id where s.expires_at > now() and u.active = true`,
    ),
  ]);
  const active = people.filter((person) => person.active);
  const needsAccess = active.filter(
    (person) => !roles.some((role) => role.userId === person.id),
  );
  return {
    checkedAt: new Date().toISOString(),
    database: {
      status: "healthy" as const,
      latencyMs: Math.round(performance.now() - started),
      connections: Number(row.connections),
    },
    sessions: Number(row.sessions),
    accounts: {
      total: people.length,
      active: active.length,
      inactive: people.length - active.length,
      withSession: Number(access.rows[0].users),
      needsAccess,
      roleCoverage: roleKeys.map((role) => ({
        role,
        count: active.filter((person) =>
          roles.some(
            (assignment) =>
              assignment.userId === person.id && assignment.role === role,
          ),
        ).length,
      })),
    },
    auditEvents24h: Number(row.events),
    documents: Number(row.documents),
    reportPhotos: Number(row.photos),
    storageBytes: Number(row.bytes),
    storage: probe
      ? await probeStorage()
      : {
          status: storageConfigured()
            ? ("configured" as const)
            : ("unconfigured" as const),
          checkedAt: null as string | null,
          message: storageConfigured()
            ? "Periksa koneksi layanan dokumen."
            : "Hubungi administrator untuk mengaktifkan layanan dokumen.",
        },
    runtime: {
      node: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  };
}
export type SystemHealth = Awaited<ReturnType<typeof systemHealth>>;

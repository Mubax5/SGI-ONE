import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { canonicalPageHref, type PageQuery } from "./workspace-url";
import { Actor, Role } from "./domain";
import { workspaceRole } from "./workspace";
export const WORKSPACE_COOKIE = "sgi.workspace";
export function redirectLegacyWorkspace(path: string, query: PageQuery) {
  if (Object.hasOwn(query, "role")) redirect(canonicalPageHref(path, query));
}
export async function activeWorkspace(
  actor: Actor,
  requested?: string | null,
  supplied?: Headers,
): Promise<Role> {
  const source = supplied ?? (await headers());
  const explicit = requested || source.get("x-sgi-workspace");
  if (explicit) return workspaceRole(actor, explicit);
  const entry = source
    .get("cookie")
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${WORKSPACE_COOKIE}=`));
  if (entry) {
    try {
      const [owner, role] = JSON.parse(
        decodeURIComponent(entry.slice(WORKSPACE_COOKIE.length + 1)),
      );
      if (owner === actor.id && actor.roles.includes(role)) return role;
    } catch {
      /* Malformed or another account's preference cannot grant access. */
    }
  }
  return workspaceRole(actor);
}
export async function scopedWorkspaceActor(
  actor: Actor,
  requested?: string | null,
  source?: Headers,
): Promise<Actor> {
  return { ...actor, roles: [await activeWorkspace(actor, requested, source)] };
}

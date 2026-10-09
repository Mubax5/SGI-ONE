"use client";

import { useSidebar } from "@cloudflare/kumo";
import { Actor, Role } from "@/lib/domain";
import { RoleDashboard } from "./role-dashboard";
import { MobileHomepage } from "./mobile-homepage";

/**
 * Deliberately separate native-mobile information architecture from desktop.
 * Never compress the desktop analytics dashboard into a phone viewport.
 */
export function Homepage({ actor, role }: { actor: Actor; role: Role }) {
  const { isMobile } = useSidebar();
  return isMobile ? (
    <MobileHomepage actor={actor} role={role} />
  ) : (
    <RoleDashboard actor={actor} role={role} presentation="dashboard" />
  );
}

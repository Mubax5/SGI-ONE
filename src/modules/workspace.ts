import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { Actor } from "@/lib/domain";
import { workspaceRole } from "@/lib/workspace";
import {
  billables,
  customers,
  dashboard,
  invoices,
  payments,
  scopedJobs,
} from "./queries";
import { reports } from "./reports";

export async function workspaceDashboard(
  actor: Actor,
  requested?: string | null,
  from?: string,
  to?: string,
) {
  const role = workspaceRole(actor, requested);
  // Choosing a workspace narrows the actor; it can never grant another role.
  const scoped: Actor = { ...actor, roles: [role] };
  switch (role) {
    case "director":
      return { role, ...(await dashboard(scoped, from, to)) };
    case "operations": {
      const [jobs, activity] = await Promise.all([
        scopedJobs(scoped),
        reports(scoped),
      ]);
      const reviews = jobs.flatMap((job) =>
        job.documents
          .filter(
            (document) =>
              document.status === "submitted" &&
              !job.documents.some(
                (other) =>
                  other.type === document.type &&
                  other.version > document.version,
              ),
          )
          .map((document) => ({ ...document, jobNumber: job.number })),
      );
      return { role, jobs, reviews, reports: activity.rows };
    }
    case "field": {
      const [jobs, activity, attendance] = await Promise.all([
        scopedJobs(scoped),
        reports(scoped),
        db
          .select()
          .from(s.attendance)
          .where(eq(s.attendance.userId, actor.id))
          .orderBy(desc(s.attendance.checkIn))
          .limit(1),
      ]);
      return {
        role,
        jobs,
        reports: activity.rows.filter((report) => report.actorId === actor.id),
        attendance,
      };
    }
    case "finance": {
      const [invoiceRows, paymentRows, components] = await Promise.all([
        invoices(scoped),
        payments(scoped),
        billables(scoped),
      ]);
      return {
        role,
        invoices: invoiceRows,
        payments: paymentRows,
        billables: components,
      };
    }
    case "sales": {
      const [customerRows, requestRows, quotationRows] = await Promise.all([
        customers(scoped),
        db
          .select({ entry: s.requests, customerName: s.customers.name })
          .from(s.requests)
          .innerJoin(s.customers, eq(s.requests.customerId, s.customers.id))
          .orderBy(desc(s.requests.createdAt)),
        db
          .select({ entry: s.quotations, customerName: s.customers.name })
          .from(s.quotations)
          .innerJoin(s.customers, eq(s.quotations.customerId, s.customers.id))
          .orderBy(desc(s.quotations.createdAt)),
      ]);
      return {
        role,
        customers: customerRows,
        requests: requestRows.map((row) => ({
          ...row.entry,
          customerName: row.customerName,
        })),
        quotations: quotationRows.map((row) => ({
          ...row.entry,
          customerName: row.customerName,
        })),
      };
    }
    case "admin": {
      const [users, roles, audit] = await Promise.all([
        db
          .select({
            id: s.user.id,
            name: s.user.name,
            email: s.user.email,
            active: s.user.active,
          })
          .from(s.user)
          .orderBy(s.user.name),
        db.select().from(s.userRoles),
        db
          .select({
            id: s.audit.id,
            action: s.audit.action,
            actorName: s.user.name,
            createdAt: s.audit.createdAt,
          })
          .from(s.audit)
          .innerJoin(s.user, eq(s.user.id, s.audit.actorId))
          .where(eq(s.audit.entity, "user"))
          .orderBy(desc(s.audit.createdAt))
          .limit(10),
      ]);
      return {
        role,
        users: users.map((user) => ({
          ...user,
          roles: roles.filter((r) => r.userId === user.id).map((r) => r.role),
        })),
        audit,
      };
    }
  }
}
export type WorkspaceData = Awaited<ReturnType<typeof workspaceDashboard>>;

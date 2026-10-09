import { eq, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import {
  Actor,
  can,
  DomainError,
  requirePermission,
  invoiceBalance,
  paymentStatus,
  checklists,
} from "@/lib/domain";
import { requireJob } from "@/lib/security";
import { defaultReportPeriod, parseReportDay } from "@/lib/report-period";
import { invoicePaid, readiness, usedBillable } from "./services";
const publicDocument = (document: typeof s.documents.$inferSelect) => {
  const { storageKey, ...doc } = document;
  void storageKey;
  return doc;
};
export async function scopedJobs(actor: Actor) {
  requirePermission(actor, "jobsRead");
  let ids: string[] | undefined;
  if (
    !actor.roles.some((r) => ["director", "operations", "finance"].includes(r))
  ) {
    ids = (
      await db
        .select()
        .from(s.assignments)
        .where(eq(s.assignments.userId, actor.id))
    ).map((a) => a.jobId);
    if (!ids.length) return [];
  }
  const rows = await db
    .select({
      job: s.jobs,
      customerName: s.customers.name,
      picName: s.user.name,
    })
    .from(s.jobs)
    .innerJoin(s.customers, eq(s.customers.id, s.jobs.customerId))
    .innerJoin(s.user, eq(s.user.id, s.jobs.picId))
    .where(ids ? inArray(s.jobs.id, ids) : undefined)
    .orderBy(desc(s.jobs.createdAt));
  if (!rows.length) return [];
  const jobIds = rows.map((r) => r.job.id);
  const assignments = await db
    .select({
      jobId: s.assignments.jobId,
      userId: s.user.id,
      name: s.user.name,
    })
    .from(s.assignments)
    .innerJoin(s.user, eq(s.user.id, s.assignments.userId))
    .where(inArray(s.assignments.jobId, jobIds));
  const documents = await db
    .select()
    .from(s.documents)
    .where(inArray(s.documents.jobId, jobIds));
  return rows.map((r) => ({
    ...r.job,
    customerName: r.customerName,
    picName: r.picName,
    assignees: assignments.filter((a) => a.jobId === r.job.id),
    documents: documents
      .filter((d) => d.jobId === r.job.id)
      .map(publicDocument),
  }));
}
export async function people(actor: Actor) {
  requirePermission(actor, "jobsWrite");
  const rows = await db
    .select({ id: s.user.id, name: s.user.name, role: s.userRoles.role })
    .from(s.user)
    .innerJoin(s.userRoles, eq(s.user.id, s.userRoles.userId))
    .where(eq(s.user.active, true));
  return rows.filter((r) => r.role === "operations" || r.role === "field");
}
export async function customers(actor: Actor) {
  requirePermission(actor, "customersRead");
  return db.select().from(s.customers).orderBy(s.customers.name);
}
export async function billables(actor: Actor) {
  requirePermission(actor, "billingRead");
  const rows = await db
    .select({
      billable: s.billables,
      job: s.jobs,
      customerName: s.customers.name,
    })
    .from(s.billables)
    .innerJoin(s.jobs, eq(s.jobs.id, s.billables.jobId))
    .innerJoin(s.customers, eq(s.customers.id, s.jobs.customerId))
    .orderBy(desc(s.billables.createdAt));
  return Promise.all(
    rows.map(async (r) => {
      const used = await usedBillable(db, r.billable.id);
      return {
        ...r.billable,
        jobNumber: r.job.number,
        customerId: r.job.customerId,
        customerName: r.customerName,
        used,
        available: r.billable.approvedAmount - used,
        blockers: await readiness(db, r.billable, r.job),
      };
    }),
  );
}
export async function invoices(actor: Actor) {
  requirePermission(actor, "invoicesRead");
  const rows = await db
    .select({ invoice: s.invoices, customerName: s.customers.name })
    .from(s.invoices)
    .innerJoin(s.customers, eq(s.customers.id, s.invoices.customerId))
    .orderBy(desc(s.invoices.createdAt));
  return Promise.all(
    rows.map(async (r) => {
      const { paid, credited } = await invoicePaid(db, r.invoice.id);
      const outstanding =
        r.invoice.status === "issued"
          ? invoiceBalance(r.invoice.total, paid, credited)
          : 0;
      const items = await db
        .select({
          item: s.invoiceItems,
          jobId: s.jobs.id,
          jobNumber: s.jobs.number,
          billable: s.billables,
          job: s.jobs,
        })
        .from(s.invoiceItems)
        .innerJoin(s.billables, eq(s.billables.id, s.invoiceItems.billableId))
        .innerJoin(s.jobs, eq(s.jobs.id, s.billables.jobId))
        .where(eq(s.invoiceItems.invoiceId, r.invoice.id));
      const blockers =
        r.invoice.status === "draft"
          ? (
              await Promise.all(
                items.map(async (x) => {
                  const errors = await readiness(db, x.billable, x.job);
                  if (
                    (await usedBillable(db, x.billable.id)) + x.item.amount >
                    x.billable.approvedAmount
                  )
                    errors.push("Saldo komponen tidak cukup");
                  return errors.map((e) => `${x.jobNumber}: ${e}`);
                }),
              )
            ).flat()
          : [];
      const corrections = await db
        .select()
        .from(s.corrections)
        .where(eq(s.corrections.invoiceId, r.invoice.id));
      const auditTrail = await db
        .select({
          id: s.audit.id,
          action: s.audit.action,
          createdAt: s.audit.createdAt,
          actorName: s.user.name,
        })
        .from(s.audit)
        .innerJoin(s.user, eq(s.user.id, s.audit.actorId))
        .where(eq(s.audit.entityId, r.invoice.id))
        .orderBy(desc(s.audit.createdAt));
      const allocationRows = await db
        .select({
          allocation: s.allocations,
          reference: s.payments.reference,
          receivedAt: s.payments.receivedAt,
        })
        .from(s.allocations)
        .innerJoin(s.payments, eq(s.payments.id, s.allocations.paymentId))
        .where(eq(s.allocations.invoiceId, r.invoice.id));
      return {
        ...r.invoice,
        customerName: r.customerName,
        paid,
        credited,
        outstanding,
        paymentStatus: paymentStatus(
          r.invoice.status,
          outstanding,
          paid,
          r.invoice.dueAt,
        ),
        items: items.map((x) => ({
          ...x.item,
          jobId: x.jobId,
          jobNumber: x.jobNumber,
        })),
        blockers,
        corrections,
        auditTrail,
        allocations: allocationRows.map((x) => ({
          ...x.allocation,
          reference: x.reference,
          receivedAt: x.receivedAt,
        })),
      };
    }),
  );
}
export async function payments(actor: Actor) {
  requirePermission(actor, "paymentsRead");
  const rows = await db
    .select({ payment: s.payments, customerName: s.customers.name })
    .from(s.payments)
    .innerJoin(s.customers, eq(s.customers.id, s.payments.customerId))
    .orderBy(desc(s.payments.receivedAt));
  const allocs = await db
    .select({ allocation: s.allocations, number: s.invoices.number })
    .from(s.allocations)
    .innerJoin(s.invoices, eq(s.invoices.id, s.allocations.invoiceId));
  return rows.map((r) => {
    const a = allocs.filter((x) => x.allocation.paymentId === r.payment.id);
    const allocated = a.reduce((n, x) => n + x.allocation.amount, 0);
    return {
      ...r.payment,
      customerName: r.customerName,
      allocated,
      unapplied: r.payment.amount - allocated,
      allocations: a.map((x) => ({ ...x.allocation, number: x.number })),
    };
  });
}
export async function jobDetail(actor: Actor, id: string) {
  const job = await requireJob(actor, id, "jobsRead");
  const [customer] = await db
    .select()
    .from(s.customers)
    .where(eq(s.customers.id, job.customerId));
  const [pic] = await db
    .select({ name: s.user.name })
    .from(s.user)
    .where(eq(s.user.id, job.picId));
  const assignments = await db
    .select({ assignment: s.assignments, name: s.user.name })
    .from(s.assignments)
    .innerJoin(s.user, eq(s.user.id, s.assignments.userId))
    .where(eq(s.assignments.jobId, id));
  const documents = await db
    .select()
    .from(s.documents)
    .where(eq(s.documents.jobId, id))
    .orderBy(desc(s.documents.createdAt));
  const progress = await db
    .select({ entry: s.progress, name: s.user.name })
    .from(s.progress)
    .innerJoin(s.user, eq(s.progress.actorId, s.user.id))
    .where(eq(s.progress.jobId, id))
    .orderBy(desc(s.progress.createdAt));
  const deliveries = await db
    .select()
    .from(s.deliveryNotes)
    .where(eq(s.deliveryNotes.jobId, id))
    .orderBy(desc(s.deliveryNotes.createdAt));
  const billableRows = can(actor, "billingRead")
    ? (await billables(actor)).filter((b) => b.jobId === id)
    : [];
  // Field sees only operational customer contact data; no financial details or tax identifiers.
  return {
    ...job,
    customer: can(actor, "customersRead")
      ? customer
      : {
          name: customer.name,
          contactName: customer.contactName,
          phone: customer.phone,
        },
    picName: pic.name,
    assignees: assignments.map((x) => ({ ...x.assignment, name: x.name })),
    documents: documents.map(publicDocument),
    progress: progress.map((x) => ({ ...x.entry, name: x.name })),
    deliveries,
    billables: billableRows,
  };
}
export async function dashboard(actor: Actor, start?: string, end?: string) {
  if (!actor.roles.includes("director"))
    throw new DomainError(
      "Laporan direktur hanya tersedia untuk direktur.",
      403,
    );
  const defaults = defaultReportPeriod();
  const from = parseReportDay(start ?? defaults.from);
  const lastDay = parseReportDay(end ?? defaults.to);
  if (!from || !lastDay || from > lastDay)
    throw new DomainError(
      "Rentang periode tidak valid. Isi tanggal awal dan akhir yang sesuai.",
    );
  const to = new Date(lastDay.getTime() + 86400000 - 1);
  // Repeatable-read gives all financial aggregates a consistent transactional snapshot.
  return db.transaction(
    async (tx) => {
      const jobRows = await tx.select().from(s.jobs);
      const docs = await tx.select().from(s.documents);
      const invoiceRows = await tx.select().from(s.invoices);
      const paymentRows = await tx.select().from(s.payments);
      const allocRows = await tx.select().from(s.allocations);
      const corrections = await tx.select().from(s.corrections);
      const bRows = await tx.select().from(s.billables);
      const iItems = await tx.select().from(s.invoiceItems);
      const customerRows = await tx.select().from(s.customers);
      const within = (d: Date | null) => d && d >= from && d <= to;
      const currencies = ["IDR", "USD", "SGD"].map((currency) => {
        const issued = invoiceRows.filter(
          (i) => i.currency === currency && i.status === "issued",
        );
        const balance = (i: (typeof issued)[number]) =>
          invoiceBalance(
            i.total,
            allocRows
              .filter((a) => a.invoiceId === i.id)
              .reduce((n, a) => n + a.amount, 0),
            corrections
              .filter((c) => c.invoiceId === i.id)
              .reduce((n, c) => n + c.amount, 0),
          );
        return {
          currency,
          billed: issued
            .filter((i) => within(i.issuedAt))
            .reduce((n, i) => n + i.total, 0),
          receipts: paymentRows
            .filter((p) => p.currency === currency && within(p.receivedAt))
            .reduce((n, p) => n + p.amount, 0),
          outstanding: issued.reduce((n, i) => n + balance(i), 0),
          overdue: issued
            .filter((i) => i.dueAt && i.dueAt < new Date())
            .reduce((n, i) => n + balance(i), 0),
          unapplied: paymentRows
            .filter((p) => p.currency === currency)
            .reduce(
              (n, p) =>
                n +
                p.amount -
                allocRows
                  .filter((a) => a.paymentId === p.id)
                  .reduce((m, a) => m + a.amount, 0),
              0,
            ),
          credits: corrections
            .filter(
              (c) =>
                c.kind === "credit_note" &&
                within(c.createdAt) &&
                invoiceRows.find((i) => i.id === c.invoiceId)?.currency ===
                  currency,
            )
            .reduce((n, c) => n + c.amount, 0),
        };
      });
      const latestDocs = docs.filter(
        (d) =>
          !docs.some(
            (n) =>
              n.jobId === d.jobId && n.type === d.type && n.version > d.version,
          ),
      );
      let ready = 0;
      for (const b of bRows) {
        const j = jobRows.find((j) => j.id === b.jobId)!;
        const used = iItems
          .filter(
            (it) =>
              it.billableId === b.id &&
              invoiceRows.find((i) => i.id === it.invoiceId)?.status ===
                "issued",
          )
          .reduce((n, it) => n + it.amount, 0);
        if (used < b.approvedAmount && !(await readiness(tx, b, j)).length)
          ready++;
      }
      const receivables = invoiceRows
        .filter((i) => i.status === "issued")
        .map((i) => {
          const paid = allocRows
            .filter((a) => a.invoiceId === i.id)
            .reduce((n, a) => n + a.amount, 0);
          const credited = corrections
            .filter((c) => c.invoiceId === i.id)
            .reduce((n, c) => n + c.amount, 0);
          return {
            ...i,
            customerName: customerRows.find((c) => c.id === i.customerId)!.name,
            paid,
            credited,
            outstanding: invoiceBalance(i.total, paid, credited),
          };
        })
        .filter((i) => i.outstanding > 0)
        .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
      return {
        period: { from, to },
        activeJobs: jobRows.filter(
          (j) => !["completed", "cancelled"].includes(j.status),
        ).length,
        jobsCreated: jobRows.filter((j) => within(j.createdAt)).length,
        pendingDocuments: latestDocs.filter((d) => d.status === "submitted")
          .length,
        rejectedDocuments: latestDocs.filter((d) => d.status === "rejected")
          .length,
        readyBillables: ready,
        issuedCount: invoiceRows.filter(
          (i) => i.status === "issued" && within(i.issuedAt),
        ).length,
        draftCount: invoiceRows.filter((i) => i.status === "draft").length,
        currencies,
        receivables,
        attention: jobRows
          .filter((j) => !["completed", "cancelled"].includes(j.status))
          .map((j) => ({
            ...j,
            customerName: customerRows.find((c) => c.id === j.customerId)!.name,
            pending: (checklists[j.serviceType] ?? []).filter(
              (type) =>
                latestDocs.find((d) => d.jobId === j.id && d.type === type)
                  ?.status !== "verified",
            ).length,
          }))
          .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function readModule(
  actor: Actor,
  resource: string,
  search: URLSearchParams,
) {
  switch (resource) {
    case "customers":
      return { rows: await customers(actor) };
    case "jobs":
      return {
        rows: await scopedJobs(actor),
        customers: can(actor, "customersRead") ? await customers(actor) : [],
        people: can(actor, "jobsWrite") ? await people(actor) : [],
        requests: can(actor, "jobsWrite")
          ? await db
              .select()
              .from(s.requests)
              .orderBy(desc(s.requests.createdAt))
          : [],
      };
    case "documents": {
      requirePermission(actor, "documentsRead");
      const jobs = await scopedJobs(actor);
      return {
        rows: jobs.flatMap((j) =>
          j.documents.map((d) => ({
            ...d,
            jobNumber: j.number,
            customerName: j.customerName,
          })),
        ),
        jobs,
      };
    }
    case "billing":
      return {
        rows: await billables(actor),
        jobs: await scopedJobs(actor),
        customers: await customers(actor),
        quotations: await db
          .select()
          .from(s.quotations)
          .where(eq(s.quotations.status, "approved")),
      };
    case "invoices":
      return {
        rows: await invoices(actor),
        billables: await billables(actor),
        customers: await customers(actor),
      };
    case "payments":
      return {
        rows: await payments(actor),
        invoices: await invoices(actor),
        customers: await customers(actor),
      };
    case "dashboard":
      return (await import("./workspace")).workspaceDashboard(
        actor,
        search.get("role"),
        search.get("from") ?? undefined,
        search.get("to") ?? undefined,
      );
    case "reports":
      return (await import("./reports")).reports(actor);
    case "quotations":
      requirePermission(actor, "quotationsRead");
      return {
        rows: await db
          .select({ quotation: s.quotations, customerName: s.customers.name })
          .from(s.quotations)
          .innerJoin(s.customers, eq(s.quotations.customerId, s.customers.id))
          .orderBy(desc(s.quotations.createdAt))
          .then((rows) =>
            rows.map((r) => ({ ...r.quotation, customerName: r.customerName })),
          ),
        customers: await customers(actor),
      };
    case "requests":
      requirePermission(actor, "quotationsRead");
      return {
        rows: await db
          .select({ request: s.requests, customerName: s.customers.name })
          .from(s.requests)
          .innerJoin(s.customers, eq(s.requests.customerId, s.customers.id))
          .orderBy(desc(s.requests.createdAt))
          .then((rows) =>
            rows.map((r) => ({ ...r.request, customerName: r.customerName })),
          ),
        customers: await customers(actor),
        people: can(actor, "jobsWrite") ? await people(actor) : [],
        quotations: await db
          .select()
          .from(s.quotations)
          .where(eq(s.quotations.status, "approved")),
      };
    case "users": {
      requirePermission(actor, "users");
      const profiles = await db
        .select({
          id: s.user.id,
          name: s.user.name,
          email: s.user.email,
          active: s.user.active,
          createdAt: s.user.createdAt,
        })
        .from(s.user)
        .orderBy(s.user.name);
      const roles = await db.select().from(s.userRoles);
      return {
        rows: profiles.map((p) => ({
          ...p,
          roles: roles.filter((r) => r.userId === p.id).map((r) => r.role),
        })),
      };
    }
    case "audit":
      requirePermission(actor, "audit");
      return {
        rows: await db
          .select({ log: s.audit, actorName: s.user.name })
          .from(s.audit)
          .innerJoin(s.user, eq(s.audit.actorId, s.user.id))
          .where(
            actor.roles.includes("director")
              ? undefined
              : eq(s.audit.entity, "user"),
          )
          .orderBy(desc(s.audit.createdAt))
          .limit(500)
          .then((rows) =>
            rows.map((r) => ({ ...r.log, actorName: r.actorName })),
          ),
      };
    case "attendance":
      return {
        rows: await db
          .select()
          .from(s.attendance)
          .where(eq(s.attendance.userId, actor.id))
          .orderBy(desc(s.attendance.checkIn))
          .limit(100),
      };
    default:
      throw new DomainError("Halaman tidak ditemukan.", 404);
  }
}
export type JobsData = Awaited<ReturnType<typeof scopedJobs>>;
export type JobData = Awaited<ReturnType<typeof jobDetail>>;
export type BillablesData = Awaited<ReturnType<typeof billables>>;
export type InvoicesData = Awaited<ReturnType<typeof invoices>>;
export type PaymentsData = Awaited<ReturnType<typeof payments>>;
export type DashboardData = Awaited<ReturnType<typeof dashboard>>;

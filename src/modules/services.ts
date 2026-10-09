import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db, Transaction } from "@/db";
import * as s from "@/db/schema";
import {
  Actor,
  DomainError,
  requirePermission,
  validateTransition,
  totals,
  invoiceBalance,
  checklists,
  documentTypes,
} from "@/lib/domain";
import { requireJob } from "@/lib/security";
import * as v from "./validation";
export async function log(
  tx: Transaction,
  actor: Actor,
  entity: string,
  entityId: string,
  action: string,
  before: unknown = null,
  after: unknown = null,
) {
  await tx
    .insert(s.audit)
    .values({ actorId: actor.id, entity, entityId, action, before, after });
}
async function activeCustomer(tx: Transaction, id: string) {
  const [customer] = await tx
    .select()
    .from(s.customers)
    .where(eq(s.customers.id, id))
    .for("update");
  if (!customer?.active)
    throw new DomainError("Customer tidak aktif atau tidak ditemukan.");
  return customer;
}
async function number(tx: Transaction, kind: "job" | "invoice") {
  const result = await tx.execute<{ seq: string }>(
    kind === "job"
      ? sql`SELECT nextval('job_number_seq') AS seq`
      : sql`SELECT nextval('invoice_number_seq') AS seq`,
  );
  return `${kind === "job" ? "JOB" : "INV"}-${new Date().getFullYear()}-${String(result.rows[0].seq).padStart(5, "0")}`;
}
export async function saveCustomer(actor: Actor, input: unknown, id?: string) {
  requirePermission(actor, "customersWrite");
  const data = v.customerInput.parse(input);
  return db.transaction(async (tx) => {
    if (id) {
      const [before] = await tx
        .select()
        .from(s.customers)
        .where(eq(s.customers.id, id))
        .for("update");
      if (!before) throw new DomainError("Customer tidak ditemukan.", 404);
      const [row] = await tx
        .update(s.customers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(s.customers.id, id))
        .returning();
      await log(tx, actor, "customer", id, "update", before, row);
      return row;
    }
    const [row] = await tx
      .insert(s.customers)
      .values({ ...data, createdBy: actor.id })
      .returning();
    await log(tx, actor, "customer", row.id, "create", null, row);
    return row;
  });
}
export async function createRequest(actor: Actor, input: unknown) {
  requirePermission(actor, "requestsWrite");
  const data = v.requestInput.parse(input);
  return db.transaction(async (tx) => {
    await activeCustomer(tx, data.customerId);
    if (data.quotationId) {
      const [q] = await tx
        .select()
        .from(s.quotations)
        .where(eq(s.quotations.id, data.quotationId));
      if (!q || q.customerId !== data.customerId || q.status !== "approved")
        throw new DomainError(
          "Penawaran harus disetujui dan berasal dari customer yang sama.",
        );
    }
    const [row] = await tx
      .insert(s.requests)
      .values({ ...data, createdBy: actor.id })
      .returning();
    await log(tx, actor, "request", row.id, "create", null, row);
    return row;
  });
}
export async function saveJob(actor: Actor, input: unknown, id?: string) {
  requirePermission(actor, "jobsWrite");
  const data = v.jobInput.parse(input);
  return db.transaction(async (tx) => {
    await activeCustomer(tx, data.customerId);
    const [pic] = await tx
      .select({ id: s.user.id })
      .from(s.user)
      .innerJoin(s.userRoles, eq(s.user.id, s.userRoles.userId))
      .where(
        and(
          eq(s.user.id, data.picId),
          eq(s.user.active, true),
          eq(s.userRoles.role, "operations"),
        ),
      );
    if (!pic)
      throw new DomainError("PIC harus pengguna Operations yang aktif.");
    if (data.requestId) {
      const [request] = await tx
        .select()
        .from(s.requests)
        .where(eq(s.requests.id, data.requestId));
      if (!request || request.customerId !== data.customerId)
        throw new DomainError("Permintaan tidak sesuai customer.");
    }
    if (id) {
      const [before] = await tx
        .select()
        .from(s.jobs)
        .where(eq(s.jobs.id, id))
        .for("update");
      if (!before) throw new DomainError("Job tidak ditemukan.", 404);
      if (before.status !== "draft")
        throw new DomainError("Detail job hanya dapat diubah saat draft.");
      const [row] = await tx
        .update(s.jobs)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(s.jobs.id, id))
        .returning();
      await log(tx, actor, "job", id, "update", before, row);
      return row;
    }
    const [row] = await tx
      .insert(s.jobs)
      .values({ ...data, number: await number(tx, "job"), createdBy: actor.id })
      .returning();
    await log(tx, actor, "job", row.id, "create", null, row);
    return row;
  });
}
export async function assignJob(actor: Actor, id: string, input: unknown) {
  requirePermission(actor, "jobsWrite");
  const data = v.assignmentInput.parse(input);
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(s.jobs)
      .where(eq(s.jobs.id, id))
      .for("update");
    if (!job) throw new DomainError("Job tidak ditemukan.", 404);
    if (["completed", "cancelled"].includes(job.status))
      throw new DomainError("Job sudah selesai atau dibatalkan.");
    const valid = await tx
      .select({ id: s.user.id })
      .from(s.user)
      .innerJoin(s.userRoles, eq(s.user.id, s.userRoles.userId))
      .where(
        and(
          inArray(s.user.id, data.userIds),
          eq(s.user.active, true),
          eq(s.userRoles.role, "field"),
        ),
      );
    if (new Set(valid.map((x) => x.id)).size !== data.userIds.length)
      throw new DomainError("Pilih petugas lapangan yang aktif.");
    const before = await tx
      .select()
      .from(s.assignments)
      .where(eq(s.assignments.jobId, id));
    await tx.delete(s.assignments).where(eq(s.assignments.jobId, id));
    await tx.insert(s.assignments).values(
      data.userIds.map((userId) => ({
        jobId: id,
        userId,
        assignedBy: actor.id,
      })),
    );
    if (job.status === "draft")
      await tx
        .update(s.jobs)
        .set({ status: "assigned", updatedAt: new Date() })
        .where(eq(s.jobs.id, id));
    await log(
      tx,
      actor,
      "job",
      id,
      "assign",
      before.map((x) => x.userId),
      data.userIds,
    );
  });
}
export async function changeJobStatus(
  actor: Actor,
  id: string,
  input: unknown,
) {
  const data = v.statusInput.parse(input);
  await requireJob(actor, id, "jobsProgress");
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(s.jobs)
      .where(eq(s.jobs.id, id))
      .for("update");
    if (!job) throw new DomainError("Job tidak ditemukan.", 404);
    await requireJob(actor, id, "jobsProgress", tx);
    if (
      !actor.roles.includes("operations") &&
      !["in_progress", "completed"].includes(data.status)
    )
      throw new DomainError(
        "Petugas hanya dapat memulai atau menyelesaikan pekerjaan.",
        403,
      );
    const assignees = await tx
      .select()
      .from(s.assignments)
      .where(eq(s.assignments.jobId, id));
    validateTransition(job.status, data.status, assignees.length);
    if (data.status === "cancelled") {
      const issued = await tx
        .select({ id: s.invoices.id })
        .from(s.billables)
        .innerJoin(
          s.invoiceItems,
          eq(s.billables.id, s.invoiceItems.billableId),
        )
        .innerJoin(s.invoices, eq(s.invoices.id, s.invoiceItems.invoiceId))
        .where(and(eq(s.billables.jobId, id), eq(s.invoices.status, "issued")));
      if (issued.length)
        throw new DomainError(
          "Koreksi invoice terkait sebelum membatalkan job.",
        );
    }
    const [row] = await tx
      .update(s.jobs)
      .set({ status: data.status, updatedAt: new Date() })
      .where(eq(s.jobs.id, id))
      .returning();
    await tx
      .insert(s.progress)
      .values({ jobId: id, actorId: actor.id, note: data.note });
    await log(
      tx,
      actor,
      "job",
      id,
      "status",
      { status: job.status },
      { status: data.status, note: data.note },
    );
    return row;
  });
}
export async function addProgress(actor: Actor, id: string, input: unknown) {
  const data = v.progressInput.parse(input);
  return db.transaction(async (tx) => {
    await tx.select().from(s.jobs).where(eq(s.jobs.id, id)).for("update");
    const job = await requireJob(actor, id, "jobsProgress", tx);
    if (["completed", "cancelled"].includes(job.status))
      throw new DomainError(
        "Progres tidak dapat ditambah pada job yang ditutup.",
      );
    const [row] = await tx
      .insert(s.progress)
      .values({ jobId: id, actorId: actor.id, note: data.note })
      .returning();
    await log(tx, actor, "job", id, "progress", null, { note: data.note });
    return row;
  });
}
export async function createDelivery(actor: Actor, id: string, input: unknown) {
  const data = v.deliveryInput.parse(input);
  return db.transaction(async (tx) => {
    await tx.select().from(s.jobs).where(eq(s.jobs.id, id)).for("update");
    const job = await requireJob(actor, id, "documentsUpload", tx);
    if (job.status === "cancelled") throw new DomainError("Job dibatalkan.");
    const [row] = await tx
      .insert(s.deliveryNotes)
      .values({ ...data, jobId: id, createdBy: actor.id })
      .returning();
    await log(tx, actor, "delivery_note", row.id, "create", null, row);
    return row;
  });
}
export async function reviewDocument(actor: Actor, id: string, input: unknown) {
  requirePermission(actor, "documentsReview");
  const data = v.reviewInput.parse(input);
  return db.transaction(async (tx) => {
    const [initial] = await tx
      .select()
      .from(s.documents)
      .where(eq(s.documents.id, id));
    if (!initial) throw new DomainError("Dokumen tidak ditemukan.", 404);
    await tx
      .select()
      .from(s.jobs)
      .where(eq(s.jobs.id, initial.jobId))
      .for("update");
    const [doc] = await tx
      .select()
      .from(s.documents)
      .where(eq(s.documents.id, id))
      .for("update");
    if (doc.status !== "submitted")
      throw new DomainError(
        "Dokumen sudah ditinjau. Unggah versi baru untuk perbaikan.",
      );
    const newer = await tx
      .select()
      .from(s.documents)
      .where(
        and(
          eq(s.documents.jobId, doc.jobId),
          eq(s.documents.type, doc.type),
          sql`${s.documents.version} > ${doc.version}`,
        ),
      );
    if (newer.length) throw new DomainError("Tinjau versi dokumen terbaru.");
    if (
      data.status === "verified" &&
      !["readable", "matches_job", "signed"].every((c) =>
        data.checklist.includes(c),
      )
    )
      throw new DomainError(
        "Pastikan dokumen terbaca, sesuai job, dan bukti penerima lengkap.",
      );
    const [row] = await tx
      .update(s.documents)
      .set({
        status: data.status,
        reviewerId: actor.id,
        reviewNote: data.note,
        reviewedAt: new Date(),
      })
      .where(eq(s.documents.id, id))
      .returning();
    await log(
      tx,
      actor,
      "document",
      id,
      "review",
      { status: doc.status },
      { status: data.status, note: data.note, checklist: data.checklist },
    );
    return row;
  });
}
export async function createBillable(actor: Actor, input: unknown) {
  requirePermission(actor, "billablesWrite");
  const data = v.billableInput.parse(input);
  return db.transaction(async (tx) => {
    await tx
      .select()
      .from(s.jobs)
      .where(eq(s.jobs.id, data.jobId))
      .for("update");
    const job = await requireJob(actor, data.jobId, "billingRead", tx);
    if (job.status === "cancelled") throw new DomainError("Job dibatalkan.");
    if (data.quotationId) {
      const [quote] = await tx
        .select()
        .from(s.quotations)
        .where(eq(s.quotations.id, data.quotationId));
      if (
        !quote ||
        quote.status !== "approved" ||
        quote.customerId !== job.customerId ||
        quote.currency !== data.currency ||
        quote.taxBps !== data.taxBps ||
        quote.termsDays !== data.termsDays
      )
        throw new DomainError(
          "Dasar kontrak/penawaran belum disetujui atau ketentuannya tidak sesuai.",
        );
    }
    const { amount, ...rest } = data;
    const [row] = await tx
      .insert(s.billables)
      .values({ ...rest, approvedAmount: amount, createdBy: actor.id })
      .returning();
    await log(tx, actor, "billable", row.id, "create", null, row);
    return row;
  });
}
export async function approveBillable(
  actor: Actor,
  id: string,
  input: unknown,
) {
  requirePermission(actor, "billablesWrite");
  const data = v.approvalInput.parse(input);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(s.billables)
      .where(eq(s.billables.id, id))
      .for("update");
    if (!row) throw new DomainError("Komponen tagihan tidak ditemukan.", 404);
    if (row.approvedBy) throw new DomainError("Komponen sudah disetujui.");
    if (row.eligibility === "advance" && !row.quotationId)
      throw new DomainError(
        "Termin awal harus memiliki kontrak/penawaran disetujui.",
      );
    const [result] = await tx
      .update(s.billables)
      .set({
        approvedBy: actor.id,
        approvedAt: new Date(),
        approvalNote: data.note,
      })
      .where(eq(s.billables.id, id))
      .returning();
    await log(tx, actor, "billable", id, "approve", null, {
      amount: result.approvedAmount,
      note: data.note,
    });
    return result;
  });
}
async function draftData(
  tx: Transaction,
  data: ReturnType<typeof v.draftInput.parse>,
) {
  await activeCustomer(tx, data.customerId);
  const rows = await tx
    .select({ billable: s.billables, job: s.jobs })
    .from(s.billables)
    .innerJoin(s.jobs, eq(s.jobs.id, s.billables.jobId))
    .where(
      inArray(
        s.billables.id,
        data.items.map((i) => i.billableId),
      ),
    );
  if (rows.length !== data.items.length)
    throw new DomainError("Komponen tagihan tidak ditemukan.");
  const first = rows[0].billable;
  for (const item of data.items) {
    const r = rows.find((x) => x.billable.id === item.billableId)!;
    if (r.job.customerId !== data.customerId)
      throw new DomainError(
        "Invoice tidak dapat menggabungkan customer berbeda.",
      );
    if (r.job.status === "cancelled") throw new DomainError("Job dibatalkan.");
    if (
      r.billable.currency !== first.currency ||
      r.billable.taxBps !== first.taxBps ||
      r.billable.termsDays !== first.termsDays
    )
      throw new DomainError(
        "Mata uang, pajak, atau termin komponen tidak kompatibel.",
      );
    if (item.amount > r.billable.approvedAmount)
      throw new DomainError("Nilai draft melebihi nilai komponen.");
  }
  return {
    rows,
    first,
    amounts: totals(
      data.items.map((i) => i.amount),
      first.taxBps,
    ),
  };
}
export async function saveDraft(actor: Actor, input: unknown, id?: string) {
  requirePermission(actor, "invoicesWrite");
  const data = v.draftInput.parse(input);
  return db.transaction(async (tx) => {
    if (id) {
      const [before] = await tx
        .select()
        .from(s.invoices)
        .where(eq(s.invoices.id, id))
        .for("update");
      if (!before || before.status !== "draft")
        throw new DomainError("Hanya invoice draft yang dapat diubah.");
    }
    const { rows, first, amounts } = await draftData(tx, data);
    const values = {
      customerId: data.customerId,
      currency: first.currency,
      taxBps: first.taxBps,
      termsDays: first.termsDays,
      ...amounts,
    };
    let row;
    if (id) {
      [row] = await tx
        .update(s.invoices)
        .set(values)
        .where(eq(s.invoices.id, id))
        .returning();
      await tx.delete(s.invoiceItems).where(eq(s.invoiceItems.invoiceId, id));
    } else {
      [row] = await tx
        .insert(s.invoices)
        .values({ ...values, createdBy: actor.id })
        .returning();
    }
    await tx.insert(s.invoiceItems).values(
      data.items.map((i) => ({
        invoiceId: row.id,
        billableId: i.billableId,
        amount: i.amount,
        description: rows.find((x) => x.billable.id === i.billableId)!.billable
          .description,
      })),
    );
    await log(
      tx,
      actor,
      "invoice",
      row.id,
      id ? "edit_draft" : "create_draft",
      null,
      { ...values, items: data.items },
    );
    return row;
  });
}
export async function deleteDraft(actor: Actor, id: string) {
  requirePermission(actor, "invoicesWrite");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(s.invoices)
      .where(eq(s.invoices.id, id))
      .for("update");
    if (!row || row.status !== "draft")
      throw new DomainError("Hanya draft yang dapat dihapus.");
    await tx.delete(s.invoiceItems).where(eq(s.invoiceItems.invoiceId, id));
    await tx.delete(s.invoices).where(eq(s.invoices.id, id));
    await log(tx, actor, "invoice", id, "delete_draft", row);
  });
}
export async function usedBillable(tx: Transaction | typeof db, id: string) {
  const result = await tx
    .select({
      amount: sql`COALESCE(SUM(${s.invoiceItems.amount}), 0)`.mapWith(Number),
    })
    .from(s.invoiceItems)
    .innerJoin(s.invoices, eq(s.invoices.id, s.invoiceItems.invoiceId))
    .where(
      and(eq(s.invoiceItems.billableId, id), eq(s.invoices.status, "issued")),
    );
  return result[0].amount;
}
export async function readiness(
  tx: Transaction | typeof db,
  billable: typeof s.billables.$inferSelect,
  job: typeof s.jobs.$inferSelect,
): Promise<string[]> {
  const errors: string[] = [];
  const [customer] = await tx
    .select({ active: s.customers.active })
    .from(s.customers)
    .where(eq(s.customers.id, job.customerId));
  if (!customer?.active) errors.push("Customer tidak aktif");
  if (!billable.approvedBy) errors.push("Tarif belum disetujui");
  if (job.status === "cancelled") errors.push("Job dibatalkan");
  if (billable.eligibility === "advance") {
    const [quote] = billable.quotationId
      ? await tx
          .select()
          .from(s.quotations)
          .where(eq(s.quotations.id, billable.quotationId))
      : [];
    if (
      !quote ||
      quote.status !== "approved" ||
      quote.customerId !== job.customerId ||
      quote.currency !== billable.currency ||
      quote.taxBps !== billable.taxBps ||
      quote.termsDays !== billable.termsDays
    )
      errors.push("Persetujuan kontrak/termin awal belum lengkap");
  } else {
    if (job.status !== "completed") errors.push("Pekerjaan belum selesai");
    const docs = await tx
      .select()
      .from(s.documents)
      .where(eq(s.documents.jobId, job.id));
    for (const type of checklists[job.serviceType] ?? []) {
      const latest = docs
        .filter((d) => d.type === type)
        .sort((a, b) => b.version - a.version)[0];
      if (latest?.status !== "verified")
        errors.push(
          `Bukti ${documentTypes[type as keyof typeof documentTypes]} belum terverifikasi`,
        );
    }
  }
  return errors;
}
export async function issueInvoice(actor: Actor, id: string) {
  requirePermission(actor, "invoicesWrite");
  return db.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(s.invoices)
      .where(eq(s.invoices.id, id))
      .for("update");
    if (!invoice || invoice.status !== "draft")
      throw new DomainError("Invoice tidak ditemukan atau sudah diterbitkan.");
    const items = await tx
      .select()
      .from(s.invoiceItems)
      .where(eq(s.invoiceItems.invoiceId, id));
    if (!items.length) throw new DomainError("Draft tidak memiliki komponen.");
    // Always lock job and billable rows in sorted order across all issue requests.
    const initial = await tx
      .select()
      .from(s.billables)
      .where(
        inArray(
          s.billables.id,
          items.map((i) => i.billableId),
        ),
      );
    const jobIds = [...new Set(initial.map((b) => b.jobId))].sort();
    await tx
      .select()
      .from(s.jobs)
      .where(inArray(s.jobs.id, jobIds))
      .orderBy(s.jobs.id)
      .for("update");
    const billableRows = await tx
      .select()
      .from(s.billables)
      .where(
        inArray(
          s.billables.id,
          items.map((i) => i.billableId),
        ),
      )
      .orderBy(s.billables.id)
      .for("update");
    const customer = await activeCustomer(tx, invoice.customerId);
    for (const item of items) {
      const b = billableRows.find((b) => b.id === item.billableId);
      if (!b) throw new DomainError("Komponen tidak ditemukan.");
      const [job] = await tx
        .select()
        .from(s.jobs)
        .where(eq(s.jobs.id, b.jobId));
      if (
        job.customerId !== invoice.customerId ||
        b.currency !== invoice.currency ||
        b.taxBps !== invoice.taxBps ||
        b.termsDays !== invoice.termsDays
      )
        throw new DomainError("Ketentuan draft tidak sesuai komponen.");
      const errors = await readiness(tx, b, job);
      if (errors.length)
        throw new DomainError(`${job.number}: ${errors.join("; ")}.`);
      if ((await usedBillable(tx, b.id)) + item.amount > b.approvedAmount)
        throw new DomainError(
          "Saldo komponen tidak cukup; kemungkinan sudah ditagih pada invoice lain.",
          409,
        );
    }
    const amounts = totals(
      items.map((i) => i.amount),
      invoice.taxBps,
    );
    const issuedAt = new Date();
    const dueAt = new Date(issuedAt.getTime() + invoice.termsDays * 86400000);
    const [row] = await tx
      .update(s.invoices)
      .set({
        status: "issued",
        number: await number(tx, "invoice"),
        issuedAt,
        dueAt,
        ...amounts,
        customerSnapshot: {
          name: customer.name,
          address: customer.address,
          taxId: customer.taxId,
          email: customer.email,
        },
      })
      .where(eq(s.invoices.id, id))
      .returning();
    await log(tx, actor, "invoice", id, "issue", { status: "draft" }, row);
    return row;
  });
}
export async function invoicePaid(tx: Transaction | typeof db, id: string) {
  const [paid] = await tx
    .select({
      amount: sql`COALESCE(SUM(${s.allocations.amount}), 0)`.mapWith(Number),
    })
    .from(s.allocations)
    .where(eq(s.allocations.invoiceId, id));
  const [credited] = await tx
    .select({
      amount: sql`COALESCE(SUM(${s.corrections.amount}), 0)`.mapWith(Number),
    })
    .from(s.corrections)
    .where(eq(s.corrections.invoiceId, id));
  return { paid: paid.amount, credited: credited.amount };
}
async function allocate(
  tx: Transaction,
  actor: Actor,
  payment: typeof s.payments.$inferSelect,
  items: { invoiceId: string; amount: number }[],
) {
  const existing = await tx
    .select()
    .from(s.allocations)
    .where(eq(s.allocations.paymentId, payment.id));
  const already = existing.reduce((n, x) => n + x.amount, 0);
  const extra = items.reduce((n, x) => n + x.amount, 0);
  if (already + extra > payment.amount)
    throw new DomainError("Total alokasi melebihi pembayaran.");
  const sorted = [...items].sort((a, b) =>
    a.invoiceId.localeCompare(b.invoiceId),
  );
  for (const item of sorted) {
    const [invoice] = await tx
      .select()
      .from(s.invoices)
      .where(eq(s.invoices.id, item.invoiceId))
      .for("update");
    if (
      !invoice ||
      invoice.status !== "issued" ||
      invoice.customerId !== payment.customerId ||
      invoice.currency !== payment.currency
    )
      throw new DomainError(
        "Invoice harus terbit dengan customer dan mata uang yang sama.",
      );
    const { paid, credited } = await invoicePaid(tx, invoice.id);
    if (item.amount > invoiceBalance(invoice.total, paid, credited))
      throw new DomainError("Alokasi melebihi saldo piutang invoice.", 409);
    const prev = existing.find((x) => x.invoiceId === invoice.id);
    if (prev)
      await tx
        .update(s.allocations)
        .set({ amount: prev.amount + item.amount })
        .where(eq(s.allocations.id, prev.id));
    else
      await tx.insert(s.allocations).values({
        paymentId: payment.id,
        invoiceId: invoice.id,
        amount: item.amount,
      });
  }
  await log(tx, actor, "payment", payment.id, "allocate", null, items);
}
export async function createPayment(actor: Actor, input: unknown) {
  requirePermission(actor, "paymentsWrite");
  const data = v.paymentInput.parse(input);
  if (data.receivedAt.getTime() > Date.now() + 60000)
    throw new DomainError("Tanggal pembayaran tidak boleh di masa depan.");
  return db.transaction(async (tx) => {
    const [customer] = await tx
      .select()
      .from(s.customers)
      .where(eq(s.customers.id, data.customerId));
    if (!customer) throw new DomainError("Customer tidak ditemukan.");
    const { allocations, ...rest } = data;
    const [row] = await tx
      .insert(s.payments)
      .values({ ...rest, createdBy: actor.id })
      .returning();
    await allocate(tx, actor, row, allocations);
    await log(tx, actor, "payment", row.id, "receive", null, rest);
    return row;
  });
}
export async function allocatePayment(
  actor: Actor,
  id: string,
  input: unknown,
) {
  requirePermission(actor, "paymentsWrite");
  const data = v.allocationInput.parse(input);
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(s.payments)
      .where(eq(s.payments.id, id))
      .for("update");
    if (!payment) throw new DomainError("Pembayaran tidak ditemukan.", 404);
    await allocate(tx, actor, payment, data.allocations);
  });
}
export async function correctInvoice(actor: Actor, id: string, input: unknown) {
  requirePermission(actor, "invoicesWrite");
  const data = v.correctionInput.parse(input);
  return db.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(s.invoices)
      .where(eq(s.invoices.id, id))
      .for("update");
    if (!invoice || invoice.status !== "issued")
      throw new DomainError("Hanya invoice terbit yang dapat dikoreksi.");
    const { paid, credited } = await invoicePaid(tx, id);
    const outstanding = invoiceBalance(invoice.total, paid, credited);
    if (data.kind === "void" && (paid > 0 || credited > 0))
      throw new DomainError(
        "Void hanya untuk invoice tanpa pembayaran/kredit. Gunakan credit note sebesar saldo tersisa.",
      );
    const amount = data.kind === "void" ? invoice.total : data.amount;
    if (!amount || amount > outstanding)
      throw new DomainError(
        "Koreksi harus positif dan tidak melebihi saldo piutang.",
      );
    const [row] = await tx
      .insert(s.corrections)
      .values({
        invoiceId: id,
        kind: data.kind,
        amount,
        reason: data.reason,
        createdBy: actor.id,
      })
      .returning();
    if (data.kind === "void")
      await tx
        .update(s.invoices)
        .set({ status: "void" })
        .where(eq(s.invoices.id, id));
    await log(tx, actor, "invoice", id, data.kind, null, row);
    return row;
  });
}
export async function saveQuotation(actor: Actor, input: unknown) {
  requirePermission(actor, "quotationsWrite");
  const data = v.quotationInput.parse(input);
  return db.transaction(async (tx) => {
    await activeCustomer(tx, data.customerId);
    let revision = 1;
    if (data.supersedesId) {
      const [prev] = await tx
        .select()
        .from(s.quotations)
        .where(eq(s.quotations.id, data.supersedesId))
        .for("update");
      if (!prev || prev.customerId !== data.customerId)
        throw new DomainError("Referensi revisi tidak sesuai customer.");
      revision = prev.revision + 1;
    }
    const [row] = await tx
      .insert(s.quotations)
      .values({ ...data, revision, createdBy: actor.id })
      .returning();
    await log(tx, actor, "quotation", row.id, "create_revision", null, row);
    return row;
  });
}
export async function approveQuotation(
  actor: Actor,
  id: string,
  input: unknown,
) {
  requirePermission(actor, "quotationsApprove");
  const data = v.approvalInput.parse(input);
  return db.transaction(async (tx) => {
    const [q] = await tx
      .select()
      .from(s.quotations)
      .where(eq(s.quotations.id, id))
      .for("update");
    if (!q || q.status !== "draft")
      throw new DomainError("Penawaran sudah disetujui atau tidak ditemukan.");
    const [row] = await tx
      .update(s.quotations)
      .set({
        status: "approved",
        approvedBy: actor.id,
        approvedAt: new Date(),
        approvalNote: data.note,
      })
      .where(eq(s.quotations.id, id))
      .returning();
    await log(tx, actor, "quotation", id, "approve", null, { note: data.note });
    return row;
  });
}
export async function createUser(actor: Actor, input: unknown) {
  requirePermission(actor, "users");
  const data = v.userInput.parse(input);
  const password = await hashPassword(data.password);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(s.user)
      .values({
        name: data.name,
        email: data.email.toLowerCase(),
        emailVerified: true,
      })
      .returning();
    await tx.insert(s.account).values({
      userId: row.id,
      accountId: row.id,
      providerId: "credential",
      password,
    });
    await tx
      .insert(s.userRoles)
      .values(
        [...new Set(data.roles)].map((role) => ({ userId: row.id, role })),
      );
    await log(tx, actor, "user", row.id, "create", null, {
      name: row.name,
      email: row.email,
      roles: data.roles,
    });
    return { id: row.id };
  });
}
export async function changeRoles(actor: Actor, id: string, input: unknown) {
  requirePermission(actor, "users");
  const data = v.roleInput.parse(input);
  return db.transaction(async (tx) => {
    // Serialize all role edits so the last admin cannot be removed concurrently.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(8147001)`);
    const [row] = await tx
      .select()
      .from(s.user)
      .where(eq(s.user.id, id))
      .for("update");
    if (!row) throw new DomainError("Pengguna tidak ditemukan.", 404);
    const prev = await tx
      .select()
      .from(s.userRoles)
      .where(eq(s.userRoles.userId, id));
    if (
      prev.some((x) => x.role === "admin") &&
      (!data.active || !data.roles.includes("admin"))
    ) {
      const remaining = await tx
        .select({ id: s.user.id })
        .from(s.user)
        .innerJoin(s.userRoles, eq(s.userRoles.userId, s.user.id))
        .where(
          and(
            ne(s.user.id, id),
            eq(s.user.active, true),
            eq(s.userRoles.role, "admin"),
          ),
        );
      if (!remaining.length)
        throw new DomainError(
          "Minimal satu administrator aktif harus tersedia.",
        );
    }
    await tx.delete(s.userRoles).where(eq(s.userRoles.userId, id));
    await tx
      .insert(s.userRoles)
      .values([...new Set(data.roles)].map((role) => ({ userId: id, role })));
    await tx
      .update(s.user)
      .set({ active: data.active, updatedAt: new Date() })
      .where(eq(s.user.id, id));
    if (!data.active)
      await tx.delete(s.session).where(eq(s.session.userId, id));
    await log(
      tx,
      actor,
      "user",
      id,
      "roles",
      { roles: prev.map((r) => r.role), active: row.active },
      data,
    );
  });
}
export async function recordAttendance(
  actor: Actor,
  kind: "in" | "out",
  input: unknown,
) {
  const data = v.attendanceInput.parse(input);
  return db.transaction(async (tx) => {
    await tx.select().from(s.user).where(eq(s.user.id, actor.id)).for("update");
    const [open] = await tx
      .select()
      .from(s.attendance)
      .where(
        and(eq(s.attendance.userId, actor.id), isNull(s.attendance.checkOut)),
      )
      .for("update");
    if (kind === "in") {
      if (open)
        throw new DomainError(
          "Anda sudah check-in. Check-out terlebih dahulu.",
        );
      const [row] = await tx
        .insert(s.attendance)
        .values({ userId: actor.id, note: data.note })
        .returning();
      await log(tx, actor, "attendance", row.id, "check_in");
      return row;
    }
    if (!open) throw new DomainError("Belum ada check-in aktif.");
    const [row] = await tx
      .update(s.attendance)
      .set({
        checkOut: new Date(),
        note: [open.note, data.note].filter(Boolean).join(" · "),
      })
      .where(eq(s.attendance.id, open.id))
      .returning();
    await log(tx, actor, "attendance", row.id, "check_out");
    return row;
  });
}

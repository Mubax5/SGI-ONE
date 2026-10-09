import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import * as s from "@/db/schema";
import type { Actor } from "@/lib/domain";
import { roleKeys, roleLabels } from "@/lib/domain";
import { requireJob } from "@/lib/security";
import * as svc from "@/modules/services";
import {
  scopedJobs,
  billables,
  dashboard,
  invoices,
  readModule,
} from "@/modules/queries";
import { uploadDocument, downloadDocument } from "@/modules/documents";
import { workspaceDashboard } from "@/modules/workspace";
import { globalSearch } from "@/modules/search";
import { createReport, reports, reportPhoto } from "@/modules/reports";
import { mapJobs, saveLocation } from "@/modules/maps";
const transport = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  fail: false,
  afterPut: undefined as undefined | (() => Promise<void>),
}));
// Only the external R2 transport is substituted in these tests. The domain,
// PostgreSQL transactions, authorization, versions and review services are real.
vi.mock("@/lib/storage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...original,
    putFile: vi.fn(async (key: string, _type: string, bytes: Uint8Array) => {
      if (transport.fail) throw new Error("R2 transport unavailable");
      transport.files.set(key, bytes);
      await transport.afterPut?.();
    }),
    getFile: vi.fn(async (key: string) => {
      const bytes = transport.files.get(key);
      if (!bytes) throw new Error("Missing test object");
      return bytes;
    }),
    deleteFile: vi.fn(async (key: string) => {
      transport.files.delete(key);
    }),
  };
});
let ops: Actor,
  field: Actor,
  otherField: Actor,
  finance: Actor,
  director: Actor,
  admin: Actor;
function guard() {
  if (
    !process.env.TEST_DATABASE_URL ||
    !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")
  )
    throw new Error(
      "Integration tests require TEST_DATABASE_URL ending in _test; run npm run test:db first.",
    );
}
async function actor(role: Actor["roles"][number]): Promise<Actor> {
  const [u] = await db
    .insert(s.user)
    .values({
      name: `Integration ${role}`,
      email: `${role}-${crypto.randomUUID()}@test.example`,
    })
    .returning();
  await db.insert(s.userRoles).values({ userId: u.id, role });
  return { ...u, roles: [role] };
}
async function fixture(
  eligibility: "advance" | "completion" = "advance",
  currency = "IDR",
  taxBps = 0,
  termsDays = 30,
) {
  const customer = await svc.saveCustomer(ops, {
    name: `Test customer ${crypto.randomUUID()}`,
    contactName: "Test contact",
    email: "test@example.com",
    phone: "0215550123",
    address: "Test address",
  });
  const job = await svc.saveJob(ops, {
    customerId: customer.id,
    source: "direct",
    serviceType: "trucking",
    description: "Integration fixture shipment",
    origin: "Bekasi",
    destination: "Jakarta",
    picId: ops.id,
    dueAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await svc.assignJob(ops, job.id, { userIds: [field.id] });
  const quote = await svc.saveQuotation(finance, {
    customerId: customer.id,
    title: "Test tariff",
    description: "Approved early installment fixture",
    amount: "5500000",
    currency,
    taxBps,
    termsDays,
  });
  await svc.approveQuotation(finance, quote.id, {
    note: "Integration fixture approval",
  });
  const billable = await svc.createBillable(finance, {
    jobId: job.id,
    description: "Test shipment tariff",
    amount: "5500000",
    currency,
    taxBps,
    termsDays,
    basis: "Approved tariff test fixture",
    eligibility,
    ...(eligibility === "advance" ? { quotationId: quote.id } : {}),
  });
  await svc.approveBillable(finance, billable.id, {
    note: "Approved tariff fixture amount",
  });
  return { customer, job, quote, billable };
}
const draft = (f: Awaited<ReturnType<typeof fixture>>, amount = "5500000") =>
  svc.saveDraft(finance, {
    customerId: f.customer.id,
    items: [{ billableId: f.billable.id, amount }],
  });
function form(type: string) {
  const f = new FormData();
  f.set("type", type);
  f.set(
    "file",
    new File(["%PDF-1.7\nfixture"], "evidence.pdf", {
      type: "application/pdf",
    }),
  );
  return f;
}
beforeAll(async () => {
  guard();
  await db
    .insert(s.roles)
    .values(roleKeys.map((key) => ({ key, label: roleLabels[key] })))
    .onConflictDoNothing();
  ops = await actor("operations");
  field = await actor("field");
  otherField = await actor("field");
  finance = await actor("finance");
  director = await actor("director");
  admin = await actor("admin");
});
afterAll(async () => {
  await pool.end();
});
describe("PRD acceptance and financial concurrency on PostgreSQL", () => {
  it("role dashboards return six different payloads and reject forged roles", async () => {
    const sales = await actor("sales");
    const actors = [admin, director, ops, finance, sales, field];
    const signatures = [];
    for (const viewer of actors) {
      const data = await workspaceDashboard(viewer);
      expect(data.role).toBe(viewer.roles[0]);
      signatures.push(Object.keys(data).sort().join(","));
      if (viewer !== director) expect(data).not.toHaveProperty("currencies");
      if (viewer !== finance) expect(data).not.toHaveProperty("payments");
    }
    expect(new Set(signatures).size).toBe(6);
    await expect(workspaceDashboard(field, "director")).rejects.toMatchObject({
      status: 403,
    });
    await expect(dashboard(field)).rejects.toMatchObject({ status: 403 });
    const f = await fixture();
    const narrowed = await workspaceDashboard(
      { ...otherField, roles: ["operations", "field"] },
      "field",
    );
    expect(narrowed.role).toBe("field");
    if (narrowed.role === "field")
      expect(narrowed.jobs.some((j) => j.id === f.job.id)).toBe(false);
  });
  it("global record search preserves job scoping and excludes forbidden resources", async () => {
    const f = await fixture();
    const own = await globalSearch(field, f.job.number);
    expect(own.results.some((r) => r.href === `/jobs/${f.job.id}`)).toBe(true);
    expect((await globalSearch(otherField, f.job.number)).results).toEqual([]);
    const billingResults = await globalSearch(finance, "Test shipment tariff");
    expect(billingResults.results.some((r) => r.type === "billing")).toBe(true);
    expect(
      (await globalSearch(field, f.customer.name)).results.every(
        (r) => !["invoices", "payments", "customers", "users"].includes(r.type),
      ),
    ).toBe(true);
    expect(
      (await globalSearch(finance, "Integration")).results.some(
        (r) => r.type === "users",
      ),
    ).toBe(false);
    await expect(
      globalSearch(field, f.job.number, "finance"),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("work reports atomically persist progress, audit and private image bytes", async () => {
    const f = await fixture();
    const data = new FormData();
    data.set("note", "Kontainer diterima di gudang demonstrasi.");
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
    data.set(
      "photo",
      new File([bytes], "bukti-demo.png", { type: "image/png" }),
    );
    const result = await createReport(field, f.job.id, data);
    expect(result.hasPhoto).toBe(true);
    expect(result).not.toHaveProperty("storageKey");
    expect((await reports(field)).rows.some((r) => r.id === result.id)).toBe(
      true,
    );
    expect(
      (await reports(otherField)).rows.some((r) => r.id === result.id),
    ).toBe(false);
    const progress = await db
      .select()
      .from(s.progress)
      .where(eq(s.progress.id, result.progressId));
    expect(progress[0].note).toBe(data.get("note"));
    const audit = await db
      .select()
      .from(s.audit)
      .where(eq(s.audit.entityId, result.id));
    expect(audit[0].action).toBe("create");
    const response = await reportPhoto(field, result.id);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(reportPhoto(otherField, result.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(reportPhoto(finance, result.id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      createReport(otherField, f.job.id, data),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("report validation and R2 failure cannot leave a successful report record", async () => {
    const f = await fixture();
    const data = new FormData();
    data.set("note", "Laporan dengan lampiran demonstrasi.");
    data.set(
      "photo",
      new File(["not a png"], "foto.png", { type: "image/png" }),
    );
    await expect(createReport(field, f.job.id, data)).rejects.toThrow();
    data.set("photo", new File([], "kosong.png", { type: "image/png" }));
    await expect(createReport(field, f.job.id, data)).rejects.toThrow();
    data.set(
      "photo",
      new File(
        [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
        "foto.png",
        { type: "image/png" },
      ),
    );
    transport.fail = true;
    try {
      await expect(createReport(field, f.job.id, data)).rejects.toThrow(
        "R2 transport unavailable",
      );
    } finally {
      transport.fail = false;
    }
    expect(
      await db
        .select()
        .from(s.workReports)
        .where(eq(s.workReports.jobId, f.job.id)),
    ).toEqual([]);
    data.delete("photo");
    expect((await createReport(field, f.job.id, data)).hasPhoto).toBe(false);
    await db
      .update(s.jobs)
      .set({ status: "cancelled" })
      .where(eq(s.jobs.id, f.job.id));
    await expect(createReport(field, f.job.id, data)).rejects.toThrow(
      "Job sudah ditutup",
    );
  });
  it("US-01 creates stable customer/job numbers and audit", async () => {
    const f = await fixture();
    expect(f.job.number).toMatch(/^JOB-\d{4}-\d{5}$/);
    const logs = await db
      .select()
      .from(s.audit)
      .where(eq(s.audit.entityId, f.job.id));
    expect(logs.map((l) => l.action)).toContain("create");
  });
  it("US-03 scopes every field read and mutation", async () => {
    const f = await fixture();
    await expect(
      requireJob(otherField, f.job.id, "jobsRead"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      svc.addProgress(otherField, f.job.id, { note: "Unauthorized update" }),
    ).rejects.toMatchObject({ status: 404 });
    const visible = await scopedJobs(otherField);
    expect(visible.find((j) => j.id === f.job.id)).toBeUndefined();
    await expect(svc.createBillable(field, {})).rejects.toMatchObject({
      status: 403,
    });
  });
  it("FR-03 deactivation preserves job relations and blocks new work", async () => {
    const f = await fixture();
    await svc.saveCustomer(
      ops,
      { ...f.customer, active: false },
      f.customer.id,
    );
    expect(
      (await db.select().from(s.jobs).where(eq(s.jobs.id, f.job.id)))[0]
        .customerId,
    ).toBe(f.customer.id);
    await expect(draft(f)).rejects.toThrow("aktif");
  });
  it("US-02/04/06 completes real domain upload, reject, resubmit, verify and issue", async () => {
    const f = await fixture("completion");
    const i = await draft(f);
    await expect(svc.issueInvoice(finance, i.id)).rejects.toThrow(
      "belum selesai",
    );
    const first = await uploadDocument(field, f.job.id, form("delivery_note"));
    await svc.reviewDocument(ops, first.id, {
      status: "rejected",
      note: "Signature is incomplete",
      checklist: ["readable"],
    });
    const second = await uploadDocument(field, f.job.id, form("delivery_note"));
    expect(second.version).toBe(2);
    const all = await db
      .select()
      .from(s.documents)
      .where(eq(s.documents.jobId, f.job.id));
    expect(all.length).toBe(2);
    expect(all.find((d) => d.id === first.id)?.status).toBe("rejected");
    const proof = await uploadDocument(
      field,
      f.job.id,
      form("proof_of_delivery"),
    );
    for (const doc of [second, proof])
      await svc.reviewDocument(ops, doc.id, {
        status: "verified",
        note: "Readable signed proof matches shipment",
        checklist: ["readable", "matches_job", "signed"],
      });
    await svc.changeJobStatus(field, f.job.id, {
      status: "in_progress",
      note: "Started field delivery",
    });
    await svc.changeJobStatus(field, f.job.id, {
      status: "completed",
      note: "Delivery completed with receiver proof",
    });
    expect((await svc.issueInvoice(finance, i.id)).status).toBe("issued");
    await expect(downloadDocument(otherField, second.id)).rejects.toMatchObject(
      { status: 404 },
    );
    expect((await downloadDocument(field, second.id)).status).toBe(200);
  });
  it("upload failure never creates a document or verification", async () => {
    const f = await fixture();
    transport.fail = true;
    try {
      await expect(
        uploadDocument(field, f.job.id, form("delivery_note")),
      ).rejects.toThrow();
    } finally {
      transport.fail = false;
    }
    expect(
      await db
        .select()
        .from(s.documents)
        .where(eq(s.documents.jobId, f.job.id)),
    ).toHaveLength(0);
  });
  it("rolls back the uploaded object if assignment disappears before metadata commit", async () => {
    const f = await fixture();
    const before = transport.files.size;
    transport.afterPut = async () => {
      await db.delete(s.assignments).where(eq(s.assignments.jobId, f.job.id));
    };
    try {
      await expect(
        uploadDocument(field, f.job.id, form("delivery_note")),
      ).rejects.toThrow();
    } finally {
      transport.afterPut = undefined;
    }
    expect(transport.files.size).toBe(before);
  });
  it("requires reviewer checklist and denies field review", async () => {
    const f = await fixture();
    const doc = await uploadDocument(field, f.job.id, form("delivery_note"));
    await expect(
      svc.reviewDocument(field, doc.id, {
        status: "verified",
        note: "No permission",
        checklist: ["readable"],
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      svc.reviewDocument(ops, doc.id, {
        status: "verified",
        note: "Missing checklist items",
        checklist: ["readable"],
      }),
    ).rejects.toThrow("Pastikan");
  });
  it("US-05 combines jobs for the same customer and rejects cross-customer", async () => {
    const a = await fixture();
    const b = await fixture();
    await expect(
      svc.saveDraft(finance, {
        customerId: a.customer.id,
        items: [
          { billableId: a.billable.id, amount: "2500000" },
          { billableId: b.billable.id, amount: "3000000" },
        ],
      }),
    ).rejects.toThrow("customer berbeda");
    const secondJob = await svc.saveJob(ops, {
      customerId: a.customer.id,
      source: "direct",
      serviceType: "trucking",
      description: "Second same-customer shipment",
      origin: "Bekasi",
      destination: "Bandung",
      picId: ops.id,
      dueAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const second = await svc.createBillable(finance, {
      jobId: secondJob.id,
      description: "Additional approved component",
      amount: "3000000",
      currency: "IDR",
      taxBps: 0,
      termsDays: 30,
      basis: "Contract early installment test",
      eligibility: "advance",
      quotationId: a.quote.id,
    });
    const result = await svc.saveDraft(finance, {
      customerId: a.customer.id,
      items: [
        { billableId: a.billable.id, amount: "2500000" },
        { billableId: second.id, amount: "3000000" },
      ],
    });
    expect(result.total).toBe(550000000);
    const read = (await invoices(finance)).find((i) => i.id === result.id)!;
    expect(new Set(read.items.map((i) => i.jobId)).size).toBe(2);
  });
  it.each([
    { currency: "USD", taxBps: 0, termsDays: 30 },
    { currency: "IDR", taxBps: 1100, termsDays: 30 },
    { currency: "IDR", taxBps: 0, termsDays: 14 },
  ])("BR-01 rejects incompatible terms %j", async (term) => {
    const f = await fixture();
    const b = await svc.createBillable(finance, {
      jobId: f.job.id,
      description: "Different terms fixture",
      amount: "100",
      ...term,
      basis: "Test incompatible tariff terms",
      eligibility: "completion",
    });
    await expect(
      svc.saveDraft(finance, {
        customerId: f.customer.id,
        items: [
          { billableId: f.billable.id, amount: "100" },
          { billableId: b.id, amount: "100" },
        ],
      }),
    ).rejects.toThrow("kompatibel");
  });
  it("US-07 permits at most one concurrent full allocation", async () => {
    const f = await fixture();
    const a = await draft(f);
    const b = await draft(f);
    const result = await Promise.allSettled([
      svc.issueInvoice(finance, a.id),
      svc.issueInvoice(finance, b.id),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await svc.usedBillable(db, f.billable.id)).toBe(550000000);
    expect(result.find((r) => r.status === "rejected")).toMatchObject({
      reason: { status: 409 },
    });
  });
  it("supports split installments without exceeding approval", async () => {
    const f = await fixture();
    const a = await draft(f, "2500000"),
      b = await draft(f, "3000000");
    await Promise.all([
      svc.issueInvoice(finance, a.id),
      svc.issueInvoice(finance, b.id),
    ]);
    expect(await svc.usedBillable(db, f.billable.id)).toBe(550000000);
    const c = await draft(f, "1");
    await expect(svc.issueInvoice(finance, c.id)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("US-08 derives partial balance and protects concurrent payments", async () => {
    const f = await fixture();
    const i = await draft(f);
    await svc.issueInvoice(finance, i.id);
    const base = {
      customerId: f.customer.id,
      currency: "IDR",
      receivedAt: new Date().toISOString(),
      method: "bank_transfer",
    };
    await svc.createPayment(finance, {
      ...base,
      amount: "2000000",
      reference: crypto.randomUUID(),
      allocations: [{ invoiceId: i.id, amount: "2000000" }],
    });
    const read = (await invoices(finance)).find((x) => x.id === i.id)!;
    expect(read.outstanding).toBe(350000000);
    expect(read.paymentStatus).toBe("partially_paid");
    const concurrent = await Promise.allSettled(
      [1, 2].map(() =>
        svc.createPayment(finance, {
          ...base,
          amount: "3500000",
          reference: crypto.randomUUID(),
          allocations: [{ invoiceId: i.id, amount: "3500000" }],
        }),
      ),
    );
    expect(concurrent.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await invoices(finance)).find((x) => x.id === i.id)?.outstanding,
    ).toBe(0);
  });
  it("BR-09 tracks unapplied credit and blocks over-allocation", async () => {
    const f = await fixture();
    const i = await draft(f);
    await svc.issueInvoice(finance, i.id);
    const payment = await svc.createPayment(finance, {
      customerId: f.customer.id,
      amount: "6000000",
      currency: "IDR",
      receivedAt: new Date().toISOString(),
      method: "cash",
      reference: crypto.randomUUID(),
      allocations: [],
    });
    await svc.allocatePayment(finance, payment.id, {
      allocations: [{ invoiceId: i.id, amount: "5500000" }],
    });
    const allocations = await db
      .select()
      .from(s.allocations)
      .where(eq(s.allocations.paymentId, payment.id));
    expect(payment.amount - allocations[0].amount).toBe(50000000);
    await expect(
      svc.allocatePayment(finance, payment.id, {
        allocations: [{ invoiceId: i.id, amount: "500001" }],
      }),
    ).rejects.toThrow();
  });
  it("refuses allocation above payment and cross customer", async () => {
    const f = await fixture(),
      other = await fixture();
    const i = await draft(f);
    await svc.issueInvoice(finance, i.id);
    await expect(
      svc.createPayment(finance, {
        customerId: f.customer.id,
        amount: "100",
        currency: "IDR",
        receivedAt: new Date().toISOString(),
        method: "cash",
        reference: crypto.randomUUID(),
        allocations: [{ invoiceId: i.id, amount: "200" }],
      }),
    ).rejects.toThrow("melebihi pembayaran");
    await expect(
      svc.createPayment(finance, {
        customerId: other.customer.id,
        amount: "100",
        currency: "IDR",
        receivedAt: new Date().toISOString(),
        method: "cash",
        reference: crypto.randomUUID(),
        allocations: [{ invoiceId: i.id, amount: "100" }],
      }),
    ).rejects.toThrow("customer");
  });
  it("BR-07 forbids edits to issued details and records credit notes", async () => {
    const f = await fixture();
    const i = await draft(f);
    await svc.issueInvoice(finance, i.id);
    await expect(
      svc.saveDraft(
        finance,
        {
          customerId: f.customer.id,
          items: [{ billableId: f.billable.id, amount: "1" }],
        },
        i.id,
      ),
    ).rejects.toThrow("draft");
    await expect(
      db.update(s.invoices).set({ total: 1 }).where(eq(s.invoices.id, i.id)),
    ).rejects.toThrow();
    await expect(
      db
        .update(s.invoiceItems)
        .set({ amount: 1 })
        .where(eq(s.invoiceItems.invoiceId, i.id)),
    ).rejects.toThrow();
    await svc.correctInvoice(finance, i.id, {
      kind: "credit_note",
      amount: "500000",
      reason: "Controlled price correction fixture",
    });
    expect(
      (await invoices(finance)).find((x) => x.id === i.id)?.outstanding,
    ).toBe(500000000);
  });
  it("void releases the component; paid invoices require bounded credit notes", async () => {
    const f = await fixture();
    const i = await draft(f);
    await svc.issueInvoice(finance, i.id);
    await svc.correctInvoice(finance, i.id, {
      kind: "void",
      reason: "Approved cancellation fixture",
    });
    expect(await svc.usedBillable(db, f.billable.id)).toBe(0);
    const next = await draft(f);
    await svc.issueInvoice(finance, next.id);
    await svc.createPayment(finance, {
      customerId: f.customer.id,
      amount: "2000000",
      currency: "IDR",
      receivedAt: new Date().toISOString(),
      method: "cash",
      reference: crypto.randomUUID(),
      allocations: [{ invoiceId: next.id, amount: "2000000" }],
    });
    await expect(
      svc.correctInvoice(finance, next.id, {
        kind: "void",
        reason: "Cancellation with existing payment",
      }),
    ).rejects.toThrow("Void");
    await expect(
      svc.correctInvoice(finance, next.id, {
        kind: "credit_note",
        amount: "3500001",
        reason: "Excess credit fixture",
      }),
    ).rejects.toThrow("saldo");
  });
  it("BR-10 requires correction before cancelling a job with issued billing", async () => {
    const f = await fixture();
    const i = await draft(f);
    await svc.issueInvoice(finance, i.id);
    await expect(
      svc.changeJobStatus(ops, f.job.id, {
        status: "cancelled",
        note: "Requested cancellation",
      }),
    ).rejects.toThrow("Koreksi");
    await svc.correctInvoice(finance, i.id, {
      kind: "void",
      reason: "Approved cancellation test",
    });
    await svc.changeJobStatus(ops, f.job.id, {
      status: "cancelled",
      note: "Cancelled after invoice correction",
    });
  });
  it("US-09 reconciles dashboard directly with issued totals and allocations", async () => {
    const report = await dashboard(director, "2000-01-01", "2999-01-01");
    const [expected] = await db
      .execute<{ billed: string }>(
        sql`SELECT COALESCE(SUM(total),0) AS billed FROM invoices WHERE status='issued' AND currency='IDR'`,
      )
      .then((r) => r.rows);
    expect(report.currencies.find((c) => c.currency === "IDR")!.billed).toBe(
      Number(expected.billed),
    );
    expect(report.draftCount).toBeGreaterThan(0);
    expect(report.currencies[0].outstanding).toBe(
      (await invoices(finance))
        .filter((i) => i.currency === "IDR")
        .reduce((n, i) => n + i.outstanding, 0),
    );
  });
  it("US-10 denies finance role mutation and protects the last admin", async () => {
    await expect(
      svc.changeRoles(finance, ops.id, { roles: ["admin"], active: true }),
    ).rejects.toMatchObject({ status: 403 });
    const admins = await db
      .select()
      .from(s.userRoles)
      .where(eq(s.userRoles.role, "admin"));
    const previousAdmins = admins.filter((r) => r.userId !== admin.id);
    // Fixture-only role edits in the guarded _test database make this assertion
    // deterministic across repeated runs without touching the demo database.
    for (const row of previousAdmins)
      await db.delete(s.userRoles).where(eq(s.userRoles.id, row.id));
    try {
      await expect(
        svc.changeRoles(admin, admin.id, { roles: ["field"], active: true }),
      ).rejects.toThrow("administrator");
    } finally {
      if (previousAdmins.length)
        await db.insert(s.userRoles).values(previousAdmins);
    }
  });
  it("FR-13 makes audit append-only and never records credentials", async () => {
    await svc.createUser(admin, {
      name: "Audit identity fixture",
      email: `${crypto.randomUUID()}@test.example`,
      password: "SafeTestPassword2026!",
      roles: ["field"],
    });
    const identityAudit = await readModule(
      admin,
      "audit",
      new URLSearchParams(),
    );
    expect("rows" in identityAudit && identityAudit.rows.length > 0).toBe(true);
    if ("rows" in identityAudit)
      expect(
        identityAudit.rows.every((r) => "entity" in r && r.entity === "user"),
      ).toBe(true);
    const [row] = await db.select().from(s.audit).limit(1);
    await expect(
      db
        .update(s.audit)
        .set({ action: "tampered" })
        .where(eq(s.audit.id, row.id)),
    ).rejects.toThrow();
    await expect(
      db.delete(s.audit).where(eq(s.audit.id, row.id)),
    ).rejects.toThrow();
    expect(JSON.stringify(await db.select().from(s.audit))).not.toContain(
      '"password"',
    );
  });
  it("FR-14 keeps approved quotations and revises into a new draft", async () => {
    const f = await fixture();
    const revision = await svc.saveQuotation(finance, {
      ...f.quote,
      amount: "6000000",
      supersedesId: f.quote.id,
    });
    expect(revision.id).not.toBe(f.quote.id);
    expect(revision.revision).toBe(2);
    expect(revision.status).toBe("draft");
    expect(
      (
        await db
          .select()
          .from(s.quotations)
          .where(eq(s.quotations.id, f.quote.id))
      )[0].status,
    ).toBe("approved");
  });
  it("FR-15 prevents parallel open attendance and uses server time", async () => {
    const results = await Promise.allSettled([
      svc.recordAttendance(field, "in", { note: "Start shift" }),
      svc.recordAttendance(field, "in", { note: "Duplicate start" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const row = await svc.recordAttendance(field, "out", { note: "End shift" });
    expect(row.checkOut).toBeInstanceOf(Date);
    await expect(svc.recordAttendance(field, "out", {})).rejects.toThrow(
      "check-in",
    );
  });
  it("map locations persist with audit and are scoped to job assignments", async () => {
    const f = await fixture();
    const coordinates = {
      originLat: -6.23,
      originLng: 106.97,
      destinationLat: -6.26,
      destinationLng: 106.81,
    };
    await saveLocation(ops, f.job.id, coordinates);
    expect(
      (await mapJobs(field)).rows.find((j) => j.id === f.job.id)?.location,
    ).toMatchObject(coordinates);
    expect(
      (await mapJobs(otherField)).rows.some((j) => j.id === f.job.id),
    ).toBe(false);
    await expect(saveLocation(field, f.job.id, coordinates)).rejects.toThrow();
    await expect(mapJobs(admin)).rejects.toThrow();
    const audit = await db
      .select()
      .from(s.audit)
      .where(eq(s.audit.entityId, f.job.id));
    expect(
      audit.some(
        (a) => a.action === "location_updated" && a.actorId === ops.id,
      ),
    ).toBe(true);
  });
  it("map coordinate validation rejects out-of-range, missing and nonnumeric values without altering saved locations", async () => {
    const f = await fixture();
    const coordinates = {
      originLat: -6.23,
      originLng: 106.97,
      destinationLat: -6.26,
      destinationLng: 106.81,
    };
    await saveLocation(ops, f.job.id, coordinates);
    for (const invalid of [
      { ...coordinates, originLat: 91 },
      { ...coordinates, destinationLng: -181 },
      { ...coordinates, originLat: "-6.23" },
      { originLat: 0 },
    ])
      await expect(saveLocation(ops, f.job.id, invalid)).rejects.toThrow();
    expect(
      (await mapJobs(field)).rows.find((j) => j.id === f.job.id)?.location,
    ).toMatchObject(coordinates);
  });
  it("ready-to-bill never includes unverified standard evidence", async () => {
    const f = await fixture("completion");
    const ready = (await billables(finance)).find(
      (b) => b.id === f.billable.id,
    )!;
    expect(ready.blockers.some((e) => e.includes("belum terverifikasi"))).toBe(
      true,
    );
  });
});

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db/index";
import * as s from "../src/db/schema";
import type { Actor } from "../src/lib/domain";
import { storageConfigured } from "../src/lib/storage";
import * as svc from "../src/modules/services";
import { uploadDocument, downloadDocument } from "../src/modules/documents";
import { invoices, dashboard } from "../src/modules/queries";
async function actor(email: string): Promise<Actor> {
  const [u] = await db.select().from(s.user).where(eq(s.user.email, email));
  if (!u?.active) throw new Error(`Seed an active ${email} account first.`);
  const roles = await db
    .select()
    .from(s.userRoles)
    .where(eq(s.userRoles.userId, u.id));
  return { id: u.id, name: u.name, email, roles: roles.map((r) => r.role) };
}
function pdf(label: string): Buffer {
  const text = `BT /F1 14 Tf 40 750 Td (${label}) Tj 0 -24 Td (Simulated proof signed by Demo Receiver for SGI acceptance.) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
  ];
  let result = "%PDF-1.4\n";
  const offsets = [0];
  for (const [i, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(result));
    result += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const start = Buffer.byteLength(result);
  result += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(result);
}
try {
  if (!storageConfigured())
    throw new Error(
      "R2 live acceptance BLOCKED: configure private R2 credentials in .env. No live storage test has been claimed.",
    );
  const ops = await actor("operations@sgi.demo"),
    field = await actor("field@sgi.demo"),
    other = await actor("field2@sgi.demo"),
    finance = await actor("finance@sgi.demo"),
    director = await actor("director@sgi.demo");
  const run = crypto.randomUUID().slice(0, 8);
  const customer = await svc.saveCustomer(ops, {
    name: `PT R2 Acceptance ${run} (Simulasi)`,
    contactName: "Demo Receiver",
    email: `r2-${run}@acceptance.example`,
    phone: "0215550199",
    address: "Alamat pengujian simulasi",
  });
  const job = await svc.saveJob(ops, {
    customerId: customer.id,
    source: "direct",
    serviceType: "trucking",
    description: `Live R2 acceptance ${run}`,
    origin: "Bekasi (simulasi)",
    destination: "Jakarta (simulasi)",
    picId: ops.id,
    dueAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await svc.assignJob(ops, job.id, { userIds: [field.id] });
  await svc.changeJobStatus(field, job.id, {
    status: "in_progress",
    note: "Live R2 acceptance: delivery started",
  });
  const data = pdf(`SGI One live R2 acceptance ${run}`);
  async function upload(type: string) {
    const form = new FormData();
    form.set("type", type);
    form.set(
      "file",
      new File([new Uint8Array(data)], `${type}-${run}.pdf`, {
        type: "application/pdf",
      }),
    );
    return uploadDocument(field, job.id, form);
  }
  const first = await upload("delivery_note");
  await svc.reviewDocument(ops, first.id, {
    status: "rejected",
    note: "Acceptance scenario: first version requires revision",
    checklist: ["readable"],
  });
  const revision = await upload("delivery_note");
  const proof = await upload("proof_of_delivery");
  for (const document of [revision, proof]) {
    await svc.reviewDocument(ops, document.id, {
      status: "verified",
      note: "Authorized simulated proof review for live R2 acceptance",
      checklist: ["readable", "matches_job", "signed"],
    });
    const response = await downloadDocument(field, document.id);
    if (!Buffer.from(await response.arrayBuffer()).equals(data))
      throw new Error("Downloaded R2 object differs from uploaded bytes");
  }
  try {
    await downloadDocument(other, revision.id);
    throw new Error("Unauthorized download unexpectedly succeeded");
  } catch (e) {
    if (!(e instanceof Error) || !("status" in e) || e.status !== 404) throw e;
  }
  await svc.changeJobStatus(field, job.id, {
    status: "completed",
    note: "Acceptance delivery completed with verified proof",
  });
  const component = await svc.createBillable(finance, {
    jobId: job.id,
    description: "Live acceptance freight charge",
    amount: "5500000",
    currency: "IDR",
    taxBps: 0,
    termsDays: 30,
    basis: "Approved simulated tariff for live R2 acceptance",
    eligibility: "completion",
  });
  await svc.approveBillable(ops, component.id, {
    note: "Authorized approval for simulated test tariff",
  });
  const draft = await svc.saveDraft(finance, {
    customerId: customer.id,
    items: [{ billableId: component.id, amount: "5500000" }],
  });
  const issued = await svc.issueInvoice(finance, draft.id);
  await svc.createPayment(finance, {
    customerId: customer.id,
    amount: "2000000",
    currency: "IDR",
    method: "bank_transfer",
    receivedAt: new Date().toISOString(),
    reference: `R2-ACCEPTANCE-${run}`,
    allocations: [{ invoiceId: issued.id, amount: "2000000" }],
  });
  const invoice = (await invoices(finance)).find((i) => i.id === issued.id)!;
  if (invoice.outstanding !== 350000000)
    throw new Error("Partial payment balance does not match PRD");
  const report = await dashboard(director);
  if (
    !report.receivables.some(
      (i) => i.id === issued.id && i.outstanding === 350000000,
    )
  )
    throw new Error("Director dashboard does not reconcile");
  console.log(
    `LIVE R2 PASS: upload, reject, version 2, verify, byte-exact authorized download, denied unassigned download, regular issue ${issued.number}, Rp2m partial payment, Rp3.5m outstanding. Job: ${job.number}. Simulated test records are retained for review.`,
  );
} catch (e) {
  console.error(e instanceof Error ? e.message : "Live R2 acceptance failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}

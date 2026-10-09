import "dotenv/config";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db, pool } from "../src/db/index";
import * as s from "../src/db/schema";
import { Actor, roleKeys, roleLabels } from "../src/lib/domain";
import * as service from "../src/modules/services";
const password = process.env.DEMO_PASSWORD;
if (
  process.env.DEMO_SEED_ENABLED !== "true" ||
  !password ||
  password.length < 12
)
  throw new Error(
    "Enable DEMO_SEED_ENABLED=true and set DEMO_PASSWORD (12+ characters) to seed simulated accounts.",
  );
const demoUsers: { email: string; name: string; roles: Actor["roles"] }[] = [
  {
    email: "admin@sgi.demo",
    name: "Administrator Demo",
    roles: ["admin", "operations", "finance", "director", "sales"],
  },
  {
    email: "operations@sgi.demo",
    name: "Ratna Pramesti",
    roles: ["operations"],
  },
  { email: "field@sgi.demo", name: "Bima Saputra", roles: ["field"] },
  { email: "field2@sgi.demo", name: "Dewi Anindita", roles: ["field"] },
  { email: "finance@sgi.demo", name: "Nadia Kartika", roles: ["finance"] },
  { email: "director@sgi.demo", name: "Arif Wibowo", roles: ["director"] },
  { email: "sales@sgi.demo", name: "Rizky Pratama", roles: ["sales"] },
];
try {
  await db
    .insert(s.roles)
    .values(roleKeys.map((key) => ({ key, label: roleLabels[key] })))
    .onConflictDoNothing();
  const users: Record<string, Actor> = {};
  const hash = await hashPassword(password);
  for (const demo of demoUsers) {
    let [row] = await db
      .select()
      .from(s.user)
      .where(eq(s.user.email, demo.email));
    if (!row) {
      row = await db.transaction(async (tx) => {
        const [u] = await tx
          .insert(s.user)
          .values({ name: demo.name, email: demo.email, emailVerified: true })
          .returning();
        await tx.insert(s.account).values({
          userId: u.id,
          accountId: u.id,
          providerId: "credential",
          password: hash,
        });
        await tx
          .insert(s.userRoles)
          .values(demo.roles.map((role) => ({ userId: u.id, role })));
        await service.log(
          tx,
          { ...u, roles: demo.roles },
          "user",
          u.id,
          "demo_seed",
          null,
          { email: u.email, roles: demo.roles },
        );
        return u;
      });
    }
    users[demo.email] = {
      id: row.id,
      name: row.name,
      email: row.email,
      roles: (
        await db
          .select()
          .from(s.userRoles)
          .where(eq(s.userRoles.userId, row.id))
      ).map((r) => r.role),
    };
  }
  const existing = await db
    .select()
    .from(s.customers)
    .where(eq(s.customers.email, "logistics@majujaya.example"));
  if (existing.length) {
    console.log(
      "Demo data already exists; existing transactions and passwords preserved.",
    );
  } else {
    const ops = users["operations@sgi.demo"],
      finance = users["finance@sgi.demo"],
      sales = users["sales@sgi.demo"],
      field = users["field@sgi.demo"],
      field2 = users["field2@sgi.demo"];
    const customer = await service.saveCustomer(ops, {
      name: "PT Maju Jaya (Simulasi)",
      contactName: "Sari Utami",
      email: "logistics@majujaya.example",
      phone: "021-555-0101",
      address: "Kawasan Industri Bekasi, Blok A-12 (alamat simulasi)",
    });
    const customer2 = await service.saveCustomer(sales, {
      name: "PT Nusantara Pangan (Simulasi)",
      contactName: "Dimas Kurniawan",
      email: "delivery@nusantarapangan.example",
      phone: "021-555-0102",
      address: "Cikarang Selatan, Blok B-08 (alamat simulasi)",
    });
    await service.saveCustomer(sales, {
      name: "PT Samudra Teknik (Simulasi)",
      contactName: "Lina Hartati",
      email: "shipping@samudrateknik.example",
      phone: "021-555-0103",
      address: "Surabaya, Kawasan Rungkut (alamat simulasi)",
    });
    const quote = await service.saveQuotation(sales, {
      customerId: customer.id,
      title: "Kontrak angkutan Oktober · simulasi",
      description:
        "Termin awal dua pengiriman; bukti kontrak dan persetujuan Finance direkam untuk demo.",
      amount: "5500000",
      currency: "IDR",
      taxBps: 0,
      termsDays: 30,
    });
    await service.approveQuotation(finance, quote.id, {
      note: "Persetujuan termin awal untuk transaksi simulasi; tanpa pajak pada demo.",
    });
    const request = await service.createRequest(sales, {
      customerId: customer.id,
      source: "contract",
      description:
        "Dua pengiriman material dari Bekasi ke Jakarta dan Bandung.",
      quotationId: quote.id,
    });
    const due = (days: number) =>
      new Date(Date.now() + days * 86400000).toISOString();
    const create = (
      customerId: string,
      description: string,
      destination: string,
      days: number,
    ) =>
      service.saveJob(ops, {
        customerId,
        ...(customerId === customer.id ? { requestId: request.id } : {}),
        source: customerId === customer.id ? "contract" : "direct",
        serviceType: "trucking",
        description,
        origin: "Gudang Bekasi",
        destination,
        picId: ops.id,
        dueAt: due(days),
      });
    const j1 = await create(
      customer.id,
      "Angkutan material kemasan · 80 karton",
      "Jakarta Selatan",
      2,
    );
    const j2 = await create(
      customer.id,
      "Angkutan suku cadang · 24 palet",
      "Bandung",
      3,
    );
    await service.assignJob(ops, j1.id, { userIds: [field.id] });
    await service.assignJob(ops, j2.id, { userIds: [field2.id] });
    await service.changeJobStatus(field, j1.id, {
      status: "in_progress",
      note: "Kendaraan berangkat dari gudang; muatan telah diperiksa.",
    });
    await service.createDelivery(field, j1.id, {
      recipient: "Sari Utami (simulasi)",
      vehicle: "B 9001 DEMO",
      cargo: "Material kemasan",
      quantity: 80,
      deliveredAt: new Date().toISOString(),
      note: "Data simulasi; bukti bertanda tangan perlu diunggah.",
    });
    const b1 = await service.createBillable(finance, {
      jobId: j1.id,
      description: "Termin angkutan Bekasi–Jakarta",
      amount: "2500000",
      currency: "IDR",
      taxBps: 0,
      termsDays: 30,
      basis: "Kontrak demo; termin awal disetujui Finance",
      eligibility: "advance",
      quotationId: quote.id,
    });
    const b2 = await service.createBillable(finance, {
      jobId: j2.id,
      description: "Termin angkutan Bekasi–Bandung",
      amount: "3000000",
      currency: "IDR",
      taxBps: 0,
      termsDays: 30,
      basis: "Kontrak demo; termin awal disetujui Finance",
      eligibility: "advance",
      quotationId: quote.id,
    });
    await service.approveBillable(finance, b1.id, {
      note: "Termin awal Rp2,5 juta disetujui sesuai kontrak simulasi.",
    });
    await service.approveBillable(finance, b2.id, {
      note: "Termin awal Rp3 juta disetujui sesuai kontrak simulasi.",
    });
    const invoice = await service.saveDraft(finance, {
      customerId: customer.id,
      items: [
        { billableId: b1.id, amount: "2500000" },
        { billableId: b2.id, amount: "3000000" },
      ],
    });
    await service.issueInvoice(finance, invoice.id);
    await service.createPayment(finance, {
      customerId: customer.id,
      amount: "2000000",
      currency: "IDR",
      receivedAt: new Date().toISOString(),
      method: "bank_transfer",
      reference: "DEMO-TRANSFER-001",
      allocations: [{ invoiceId: invoice.id, amount: "2000000" }],
    });
    const j3 = await create(
      customer2.id,
      "Pengiriman bahan pangan kering · 120 karton",
      "Tangerang",
      -1,
    );
    await service.assignJob(ops, j3.id, { userIds: [field.id] });
    await service.changeJobStatus(field, j3.id, {
      status: "in_progress",
      note: "Muatan sedang dikirim ke fasilitas pelanggan.",
    });
    const b3 = await service.createBillable(finance, {
      jobId: j3.id,
      description: "Angkutan Bekasi–Tangerang",
      amount: "4200000",
      currency: "IDR",
      taxBps: 0,
      termsDays: 30,
      basis: "Persetujuan tarif tertulis untuk simulasi pengiriman",
      eligibility: "completion",
    });
    await service.approveBillable(ops, b3.id, {
      note: "Tarif demo disetujui Operations; bukti wajib sebelum penerbitan.",
    });
    await service.saveDraft(finance, {
      customerId: customer2.id,
      items: [{ billableId: b3.id, amount: "4200000" }],
    });
    await create(
      customer2.id,
      "Distribusi pengiriman berikutnya · 60 karton",
      "Bogor",
      4,
    );
    await service.recordAttendance(field, "in", {
      note: "Check-in demo di gudang Bekasi.",
    });
    console.log(
      "Realistic simulated demo seeded: combined invoice Rp5,500,000, partial payment Rp2,000,000, receivable Rp3,500,000. No fabricated verified documents.",
    );
  }
  // Approximate city points for the four explicitly synthetic demo jobs only.
  // Never overwrite a coordinate saved by Operations or infer real customer locations.
  const demoCoordinates: Record<string, [number, number]> = {
    "Angkutan material kemasan · 80 karton": [-6.2615, 106.8106],
    "Angkutan suku cadang · 24 palet": [-6.9175, 107.6191],
    "Pengiriman bahan pangan kering · 120 karton": [-6.1783, 106.6319],
    "Distribusi pengiriman berikutnya · 60 karton": [-6.5971, 106.806],
  };
  const demoJobs = await db
    .select({ job: s.jobs, customer: s.customers })
    .from(s.jobs)
    .innerJoin(s.customers, eq(s.jobs.customerId, s.customers.id));
  await db.transaction(async (tx) => {
    for (const { job, customer } of demoJobs) {
      const destination = demoCoordinates[job.description];
      if (
        !destination ||
        !customer.name.endsWith("(Simulasi)") ||
        job.origin !== "Gudang Bekasi"
      )
        continue;
      const [location] = await tx
        .insert(s.jobLocations)
        .values({
          jobId: job.id,
          originLat: -6.2383,
          originLng: 106.9756,
          destinationLat: destination[0],
          destinationLng: destination[1],
          updatedBy: users["operations@sgi.demo"].id,
        })
        .onConflictDoNothing()
        .returning();
      if (location)
        await service.log(
          tx,
          users["operations@sgi.demo"],
          "job",
          job.id,
          "demo_location_seed",
          null,
          location,
        );
    }
  });
  console.log(
    "Demo map coordinates seeded without replacing existing locations.",
  );
  console.log(
    "Demo accounts: admin, operations, field, field2, finance, director, sales @sgi.demo. Password: DEMO_PASSWORD in .env.",
  );
} finally {
  await pool.end();
}

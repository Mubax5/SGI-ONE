import { test, expect, Page, APIRequestContext } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
const password = process.env.DEMO_PASSWORD!;
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:4310";
const headers = { Origin: baseURL };
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  for (let attempt = 0; attempt < 4; attempt++) {
    const signingIn = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/sign-in/email") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    const response = await signingIn;
    if (response.status() === 429 && attempt < 3) {
      const seconds = Number(response.headers()["retry-after"] ?? "11");
      await page.waitForTimeout(Math.min(Math.max(seconds + 1, 11), 60) * 1000);
      continue;
    }
    expect(response.ok()).toBe(true);
    break;
  }
  await expect(page).toHaveURL(
    /\/(home|dashboard|jobs|invoices|customers|users|attendance)$/,
  );
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator(".loading-state")).toHaveCount(0);
}
async function apiLogin(request: APIRequestContext, email: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await request.post("/api/auth/sign-in/email", {
      headers,
      data: { email, password },
    });
    if (response.status() === 429 && attempt < 3) {
      const seconds = Number(response.headers()["retry-after"] ?? "11");
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(Math.max(seconds + 1, 11), 60) * 1000),
      );
      continue;
    }
    expect(response.ok(), await response.text()).toBe(true);
    return;
  }
}
async function post<T>(
  request: APIRequestContext,
  path: string,
  data: unknown,
): Promise<T> {
  const response = await request.post(`/api/${path}`, { headers, data });
  expect(response.ok(), await response.text()).toBe(true);
  return await response.json();
}
async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
test.beforeAll(() => {
  if (!password)
    throw new Error("Set DEMO_PASSWORD and run db:seed before E2E tests.");
  mkdirSync("artifacts/screenshots", { recursive: true });
});
test("FR-01 unauthenticated endpoints and public sign-up are closed", async ({
  request,
}) => {
  expect((await request.get("/api/data/jobs")).status()).toBe(401);
  const signup = await request.post("/api/auth/sign-up/email", {
    headers,
    data: { name: "Unknown", email: "unknown@example.com", password },
  });
  expect(signup.ok()).toBe(false);
  const mutation = await request.post("/api/customers", { data: {} });
  expect(mutation.status()).toBe(403);
});
test("desktop login, director reconciliation and screenshots", async ({
  page,
}) => {
  await login(page, "director@sgi.demo");
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Analitik", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("3.500.000", { exact: false }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/screenshots/director-desktop.png",
    fullPage: true,
  });
  const report = await page.request.get("/api/data/dashboard");
  expect(report.ok()).toBe(true);
  const data = await report.json();
  const invoiceRows = await page.request
    .get("/api/data/invoices")
    .then((r) => r.json());
  const total = invoiceRows.rows
    .filter((i: { currency: string }) => i.currency === "IDR")
    .reduce((n: number, i: { outstanding: number }) => n + i.outstanding, 0);
  expect(
    data.currencies.find((r: { currency: string }) => r.currency === "IDR")
      .outstanding,
  ).toBe(total);
  expect(
    invoiceRows.rows.some(
      (i: { customerName: string; outstanding: number }) =>
        i.customerName.includes("Maju Jaya") && i.outstanding === 350000000,
    ),
  ).toBe(true);
  expect(
    (await page.request.post("/api/customers", { headers, data: {} })).status(),
  ).toBe(403);
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect((await page.request.get("/api/data/dashboard")).status()).toBe(401);
});
test("US-01 Operations creates a customer and functional assigned job through UI", async ({
  page,
}) => {
  await login(page, "operations@sgi.demo");
  await page.goto("/customers");
  await page.getByRole("button", { name: "Tambah customer" }).click();
  const name = `PT UI Test ${Date.now()}`;
  await page.getByLabel("Nama perusahaan", { exact: true }).fill(name);
  await page.getByLabel("Nama kontak", { exact: true }).fill("Rina Demo");
  await page
    .getByLabel("Email kontak", { exact: true })
    .fill("ui-test@example.com");
  await page.getByLabel("Telepon", { exact: true }).fill("0215550111");
  await page
    .getByLabel("Alamat penagihan", { exact: true })
    .fill("Bekasi (simulasi)");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Cari data" }).fill(name);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.goto("/jobs");
  await page.getByRole("button", { name: "Buat job order" }).click();
  await choose(page, "Customer", name);
  await page
    .getByLabel("Deskripsi pekerjaan", { exact: true })
    .fill("Pengiriman uji UI dari Bekasi ke Jakarta");
  await page.getByLabel("Lokasi asal", { exact: true }).fill("Bekasi");
  await page.getByLabel("Lokasi tujuan", { exact: true }).fill("Jakarta");
  await choose(page, "PIC Operations", "Ratna Pramesti");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Cari data" }).fill(name);
  await page.getByRole("link", { name: /^JOB-/ }).first().click();
  await expect(
    page
      .getByText("Pengiriman uji UI dari Bekasi ke Jakarta", { exact: false })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Atur penugasan" }).click();
  await page.getByRole("checkbox", { name: "Bima Saputra" }).check();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Bima Saputra", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "artifacts/screenshots/job-desktop.png",
    fullPage: true,
  });
});
test("US-03 mobile field workspace hides finance and denies other assignments", async ({
  page,
  playwright,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "field@sgi.demo");
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "SGI One · Homepage", exact: true }),
  ).toBeVisible();
  const ownJobs = await page.request
    .get("/api/data/jobs")
    .then((r) => r.json());
  const field2 = await playwright.request.newContext({ baseURL });
  await apiLogin(field2, "field2@sgi.demo");
  const otherJobs = await field2.get("/api/data/jobs").then((r) => r.json());
  const forbidden = otherJobs.rows.find(
    (j: { id: string }) =>
      !ownJobs.rows.some((o: { id: string }) => o.id === j.id),
  );
  expect(forbidden).toBeTruthy();
  expect((await page.request.get(`/api/jobs/${forbidden.id}`)).status()).toBe(
    404,
  );
  expect((await page.request.get("/api/data/invoices")).status()).toBe(403);
  const seedJob = ownJobs.rows.find(
    (j: { customerName: string; status: string }) =>
      j.customerName.includes("Maju Jaya") && j.status !== "cancelled",
  );
  await page.goto(`/jobs/${seedJob.id}`);
  await expect(
    page.getByRole("button", { name: "Unggah dokumen" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/screenshots/field-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Invoice", exact: true }),
  ).toHaveCount(0);
  await field2.dispose();
});
test("all permitted admin modules load without client errors, dialogs are keyboard accessible", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "admin@sgi.demo");
  for (const route of [
    "customers",
    "requests",
    "quotations",
    "jobs",
    "documents",
    "billing",
    "invoices",
    "payments",
    "attendance",
    "users",
    "audit",
  ]) {
    await page.goto(`/${route}`);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText("Memuat data transaksi…")).toHaveCount(0);
    await expect(page.locator('.feedback[role="alert"]')).toHaveCount(0);
  }
  await page.goto("/invoices");
  await page
    .getByRole("button", { name: "Detail", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/screenshots/invoices-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("real Better Auth sessions refresh roles on next request; Finance cannot administer access", async ({
  request,
  playwright,
}) => {
  await apiLogin(request, "admin@sgi.demo");
  const email = `rbac-${Date.now()}@test.example`;
  const user = await post<{ id: string }>(request, "users", {
    name: "RBAC test account",
    email,
    password,
    roles: ["finance"],
  });
  const client = await playwright.request.newContext({ baseURL });
  await apiLogin(client, email);
  expect((await client.get("/api/data/invoices")).status()).toBe(200);
  expect(
    (
      await client.post(`/api/users/${user.id}/roles`, {
        headers,
        data: { roles: ["admin"], active: true },
      })
    ).status(),
  ).toBe(403);
  await post(request, `users/${user.id}/roles`, {
    roles: ["field"],
    active: true,
  });
  expect((await client.get("/api/data/invoices")).status()).toBe(403);
  await post(request, `users/${user.id}/roles`, {
    roles: ["field"],
    active: false,
  });
  expect((await client.get("/api/data/jobs")).status()).toBe(401);
  await client.dispose();
});
test("R2 missing-configuration errors are explicit and preserve document state", async ({
  request,
}) => {
  await apiLogin(request, "field@sgi.demo");
  const me = await request.get("/api/me").then((r) => r.json());
  if (me.storageConfigured) {
    test.skip(
      true,
      "Real R2 configured: run the dedicated R2 acceptance test.",
    );
    return;
  }
  const data = await request.get("/api/data/jobs").then((r) => r.json());
  const job = data.rows.find(
    (r: { status: string }) => r.status !== "cancelled",
  );
  const before = job.documents.length;
  const response = await request.post(`/api/jobs/${job.id}/upload`, {
    headers,
    multipart: {
      type: "delivery_note",
      file: {
        name: "demo.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7\nfixture"),
      },
    },
  });
  expect(response.status()).toBe(503);
  expect((await response.json()).error).toContain("R2");
  const after = await request.get(`/api/jobs/${job.id}`).then((r) => r.json());
  expect(after.documents.length).toBe(before);
});

test("Finance forms create approved billables, a combined invoice, partial payment, credit note and printable invoice", async ({
  page,
  playwright,
}) => {
  const setup = await playwright.request.newContext({ baseURL });
  await apiLogin(setup, "admin@sgi.demo");
  const run = Date.now().toString();
  const name = `PT Finance UI ${run} (Simulasi)`;
  const customer = await post<{ id: string }>(setup, "customers", {
    name,
    contactName: "Finance demo contact",
    email: `finance-${run}@test.example`,
    phone: "0215550199",
    address: "Alamat simulasi Bekasi",
  });
  const data = await setup.get("/api/data/jobs").then((r) => r.json());
  const pic = data.people.find(
    (p: { name: string; role: string }) =>
      p.name === "Ratna Pramesti" && p.role === "operations",
  );
  const jobs: { id: string; number: string }[] = [];
  for (const destination of ["Jakarta", "Bandung"])
    jobs.push(
      await post(setup, "jobs", {
        customerId: customer.id,
        serviceType: "trucking",
        source: "contract",
        description: `Finance form test ${run} to ${destination}`,
        origin: "Bekasi",
        destination,
        picId: pic.id,
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    );
  const quoteTitle = `Kontrak UI ${run}`;
  const quote = await post<{ id: string }>(setup, "quotations", {
    customerId: customer.id,
    title: quoteTitle,
    description: "Simulated advance installment for finance form test",
    amount: "5500000",
    currency: "IDR",
    taxBps: 0,
    termsDays: 30,
  });
  await post(setup, `quotations/${quote.id}/approve`, {
    note: "Approved simulated advance terms for browser acceptance",
  });
  await login(page, "finance@sgi.demo");
  await page.goto("/billing");
  for (const [index, job] of jobs.entries()) {
    await page.getByRole("button", { name: "Tambah komponen" }).click();
    await choose(page, "Job order", `${job.number} · ${name}`);
    await page
      .getByLabel("Komponen tagihan", { exact: true })
      .fill(`Angkutan UI ${index + 1} ${run}`);
    await page
      .getByLabel("Nominal komponen", { exact: true })
      .fill(index === 0 ? "2500000" : "3000000");
    await page
      .getByLabel("Dasar tarif / persetujuan", { exact: true })
      .fill("Kontrak simulasi dengan termin awal disetujui");
    await choose(
      page,
      "Kelayakan penerbitan",
      "Termin awal dengan kontrak disetujui",
    );
    await choose(
      page,
      "Kontrak / penawaran disetujui",
      `${quoteTitle} · revisi 1`,
    );
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.getByRole("textbox", { name: "Cari data" }).fill(run);
  for (const index of [1, 2]) {
    await page
      .getByRole("row")
      .filter({ hasText: `Angkutan UI ${index} ${run}` })
      .getByRole("button", { name: "Setujui tarif" })
      .click();
    await page
      .getByLabel("Dasar dan catatan persetujuan", { exact: true })
      .fill("Nominal dan termin kontrak simulasi disetujui");
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.goto("/invoices");
  await page.getByRole("button", { name: "Buat draft invoice" }).click();
  await choose(page, "Customer", name);
  for (const index of [1, 2])
    await page
      .getByRole("checkbox", {
        name: new RegExp(`Angkutan UI ${index} ${run}`),
      })
      .check();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Cari data" }).fill(name);
  await page.getByRole("button", { name: "Terbitkan", exact: true }).click();
  await page
    .getByRole("button", { name: "Terbitkan invoice", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const invoiceData = await page.request
    .get("/api/data/invoices")
    .then((r) => r.json());
  const invoice = invoiceData.rows.find(
    (i: { customerId: string }) => i.customerId === customer.id,
  );
  expect(invoice.total).toBe(550000000);
  expect(
    new Set(invoice.items.map((i: { jobId: string }) => i.jobId)).size,
  ).toBe(2);
  await page.goto("/payments");
  await page.getByRole("button", { name: "Catat pembayaran" }).click();
  await choose(page, "Customer", name);
  await page.getByLabel("Nilai penerimaan", { exact: true }).fill("2000000");
  await page
    .getByLabel("Referensi pembayaran unik", { exact: true })
    .fill(`FINANCE-UI-${run}`);
  await page
    .getByRole("checkbox", { name: invoice.number, exact: true })
    .check();
  await page.getByLabel("Nominal alokasi", { exact: true }).fill("2000000");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const paid = await page.request
    .get("/api/data/invoices")
    .then((r) => r.json());
  expect(
    paid.rows.find((i: { id: string }) => i.id === invoice.id).outstanding,
  ).toBe(350000000);
  await page.goto(`/invoices/${invoice.id}/print`);
  await expect(
    page.getByRole("heading", {
      name: `Invoice ${invoice.number}`,
      exact: true,
    }),
  ).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: "artifacts/screenshots/invoice-print.pdf",
    format: "A4",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.goto("/invoices");
  await page.getByRole("textbox", { name: "Cari data" }).fill(name);
  await page.getByRole("button", { name: "Detail", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Audit invoice", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Void / credit note" }).click();
  await page.getByLabel("Nilai credit note", { exact: true }).fill("3500000");
  await page
    .getByLabel("Alasan koreksi", { exact: true })
    .fill("Close simulated UI test receivable after verifying partial payment");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const corrected = await page.request
    .get("/api/data/invoices")
    .then((r) => r.json());
  expect(
    corrected.rows.find((i: { id: string }) => i.id === invoice.id).outstanding,
  ).toBe(0);
  await setup.dispose();
});

test("live R2 field forms create delivery, upload revisions and Operations verifies private proof", async ({
  page,
  playwright,
}) => {
  const setup = await playwright.request.newContext({ baseURL });
  await apiLogin(setup, "operations@sgi.demo");
  const me = await setup.get("/api/me").then((r) => r.json());
  test.skip(!me.storageConfigured, "Requires real private R2 credentials.");
  const run = Date.now().toString();
  const customer = await post<{ id: string }>(setup, "customers", {
    name: `PT Document UI ${run} (Simulasi)`,
    contactName: "Penerima Simulasi",
    email: `document-${run}@test.example`,
    phone: "0215550111",
    address: "Bekasi (simulasi)",
  });
  const data = await setup.get("/api/data/jobs").then((r) => r.json());
  const pic = data.people.find(
    (p: { name: string; role: string }) =>
      p.name === "Ratna Pramesti" && p.role === "operations",
  );
  const field = data.people.find(
    (p: { name: string; role: string }) =>
      p.name === "Bima Saputra" && p.role === "field",
  );
  const job = await post<{ id: string }>(setup, "jobs", {
    customerId: customer.id,
    serviceType: "trucking",
    source: "direct",
    description: `Document browser acceptance ${run}`,
    origin: "Bekasi",
    destination: "Jakarta",
    picId: pic.id,
    dueAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await post(setup, `jobs/${job.id}/assign`, { userIds: [field.id] });
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "field@sgi.demo");
  await page.goto(`/jobs/${job.id}`);
  await page
    .getByRole("button", { name: "Perbarui status", exact: true })
    .click();
  await page
    .getByLabel("Catatan perubahan", { exact: true })
    .fill("Berangkat dengan barang simulasi");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("tab", { name: "Surat jalan digital", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Buat surat jalan", exact: true })
    .click();
  await page
    .getByLabel("Nama penerima", { exact: true })
    .fill("Penerima Simulasi");
  await page
    .getByLabel("Nomor kendaraan / referensi angkutan", { exact: true })
    .fill("B 1234 DEMO");
  await page
    .getByLabel("Deskripsi barang", { exact: true })
    .fill("10 karton barang simulasi");
  await page.getByLabel("Jumlah unit", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const delivery = await page.request
    .get(`/api/jobs/${job.id}`)
    .then((r) => r.json());
  await page.goto(`/jobs/${job.id}/delivery/${delivery.deliveries[0].id}`);
  await expect(
    page.getByText("Penerima: Penerima Simulasi", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".print-table")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBe(true);
  await page.emulateMedia({ media: "print" });
  const proofPath = `artifacts/screenshots/delivery-live-${run}.pdf`;
  await page.pdf({ path: proofPath, format: "A4", printBackground: true });
  await page.emulateMedia({ media: "screen" });
  const proofBytes = readFileSync(proofPath);
  async function upload(name: string, type = "Surat jalan bertanda tangan") {
    await page.goto(`/jobs/${job.id}`);
    await page
      .getByRole("button", { name: "Unggah dokumen", exact: true })
      .click();
    await choose(page, "Jenis dokumen", type);
    await page
      .getByLabel("File dokumen privat", { exact: true })
      .setInputFiles({
        name,
        mimeType: "application/pdf",
        buffer: proofBytes,
      });
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  const firstName = `surat-jalan-${run}-v1.pdf`;
  await upload(firstName);
  const opsContext = await page.context().browser()!.newContext({ baseURL });
  const opsPage = await opsContext.newPage();
  await login(opsPage, "operations@sgi.demo");
  async function review(name: string, reject = false) {
    await opsPage.goto(`/jobs/${job.id}`);
    await opsPage
      .getByRole("row")
      .filter({ hasText: name })
      .getByRole("button", { name: "Review", exact: true })
      .click();
    if (reject) await choose(opsPage, "Keputusan", "Tolak dan minta perbaikan");
    await opsPage
      .getByLabel("Catatan review / alasan penolakan", { exact: true })
      .fill(
        reject
          ? "Perbaiki lampiran simulasi"
          : "Dokumen simulasi sesuai pekerjaan",
      );
    for (const label of [
      "Dokumen terbaca dan lengkap",
      "Customer, muatan, dan rute sesuai job",
      "Tanda tangan / bukti penerima lengkap",
    ])
      await opsPage.getByRole("checkbox", { name: label, exact: true }).check();
    await opsPage.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(opsPage.getByRole("dialog")).toHaveCount(0);
  }
  await review(firstName, true);
  const secondName = `surat-jalan-${run}-v2.pdf`;
  await upload(secondName);
  await review(secondName);
  const podName = `bukti-serah-terima-${run}.pdf`;
  await upload(podName, "Bukti serah terima");
  await review(podName);
  const current = await page.request
    .get(`/api/jobs/${job.id}`)
    .then((r) => r.json());
  expect(
    current.documents.find(
      (d: { filename: string }) => d.filename === firstName,
    ).status,
  ).toBe("rejected");
  expect(
    current.documents.find(
      (d: { filename: string }) => d.filename === secondName,
    ).version,
  ).toBe(2);
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("row")
    .filter({ hasText: podName })
    .getByRole("button", { name: "Unduh", exact: true })
    .click();
  expect(readFileSync((await (await downloaded).path())!)).toEqual(proofBytes);
  const other = await playwright.request.newContext({ baseURL });
  await apiLogin(other, "field2@sgi.demo");
  expect(
    (
      await other.get(
        `/api/documents/${current.documents.find((d: { filename: string }) => d.filename === podName).id}/download`,
      )
    ).status(),
  ).toBe(404);
  await page.reload();
  await page
    .getByRole("button", { name: "Perbarui status", exact: true })
    .click();
  await page
    .getByLabel("Catatan perubahan", { exact: true })
    .fill("Serah terima simulasi selesai dengan bukti diverifikasi");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    (await page.request.get(`/api/jobs/${job.id}`).then((r) => r.json()))
      .status,
  ).toBe("completed");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/screenshots/documents-live-mobile.png",
    fullPage: true,
  });
  await opsPage.reload();
  await expect(
    opsPage.getByRole("row").filter({ hasText: podName }),
  ).toContainText("Terverifikasi");
  await opsPage.screenshot({
    path: "artifacts/screenshots/documents-live-desktop.png",
    fullPage: true,
  });
  await other.dispose();
  await opsContext.close();
  await setup.dispose();
});

test("Kumo navigation collapses, searches by keyboard, switches modules and restores mobile focus", async ({
  page,
}) => {
  await login(page, "admin@sgi.demo");
  await page.goto("/analytics");
  const sidebar = page.getByRole("complementary", {
    name: "Navigasi SGI",
    exact: true,
  });
  await expect
    .poll(async () => Math.round((await sidebar.boundingBox())!.width))
    .toBe(260);
  expect(
    Math.round((await page.getByRole("banner").boundingBox())!.height),
  ).toBe(58);
  const operations = sidebar.getByRole("button", {
    name: "Operasional",
    exact: true,
  });
  await operations.click();
  await expect(operations).toHaveAttribute("aria-expanded", "false");
  await operations.click();
  await expect(operations).toHaveAttribute("aria-expanded", "true");
  await sidebar
    .getByRole("button", { name: "Ringkas sidebar", exact: true })
    .click();
  await expect
    .poll(async () => Math.round((await sidebar.boundingBox())!.width))
    .toBe(57);
  await sidebar
    .getByRole("button", { name: "Perluas sidebar", exact: true })
    .click();
  await expect
    .poll(async () => Math.round((await sidebar.boundingBox())!.width))
    .toBe(260);
  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox", {
    name: "Cari fitur dan data SGI",
    exact: true,
  });
  await search.fill("Pembayaran");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/payments(?:\?role=admin)?$/);
  await expect(
    page.getByRole("heading", { name: "Pembayaran", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Halaman dalam bagian" })
    .getByRole("tab", { name: "Invoice", exact: true })
    .click();
  await expect(page).toHaveURL(/\/invoices(?:\?role=admin)?$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Semua menu", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Menu", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await login(page, "field@sgi.demo");
  await page.keyboard.press("Control+k");
  await search.fill("Invoice");
  await expect(
    page.getByText(
      "Tidak ada hasil. Coba nomor job, nama customer, atau kata kunci lain.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await page.keyboard.press("Escape");
});

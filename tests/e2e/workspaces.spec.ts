import { test, expect, Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
const password = process.env.DEMO_PASSWORD!;
async function login(page: Page, role: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(`${role}@sgi.demo`);
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  for (let attempt = 0; attempt < 4; attempt++) {
    const pending = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/auth/sign-in/email") &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    const response = await pending;
    if (response.status() === 429 && attempt < 3) {
      await page.waitForTimeout(
        Math.min(
          Math.max(Number(response.headers()["retry-after"] ?? "11") + 1, 11),
          60,
        ) * 1000,
      );
      continue;
    }
    expect(response.ok()).toBe(true);
    break;
  }
  await expect(page).toHaveURL(/home$/);
  await expect(page.locator(".loading-state")).toHaveCount(0);
}
async function overflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const offenders = await page
    .locator(
      ".role-hero,.home-all-features .home-shortcut,.responsive-table,.cell-content,[role=dialog],.mobile-bottom-nav>a,.mobile-bottom-nav>button",
    )
    .evaluateAll((elements) =>
      elements
        .filter(
          (e) =>
            e.getBoundingClientRect().width > 0 &&
            e.scrollWidth > e.clientWidth + 2,
        )
        .map((e) => ({
          class: e.className,
          text: e.textContent?.slice(0, 70),
          width: e.clientWidth,
          scroll: e.scrollWidth,
        })),
    );
  expect(offenders).toEqual([]);
}
test("six genuine role dashboards, complete mobile menus and floating role actions", async ({
  browser,
}) => {
  test.setTimeout(360000);
  mkdirSync("artifacts/screenshots", { recursive: true });
  const cases = [
    {
      role: "admin",
      section: "Akses pengguna aktif",
      action: "Pengguna",
      dialog: "Tambah pengguna",
    },
    { role: "director", section: "Posisi keuangan", action: "Laporan" },
    {
      role: "operations",
      section: "Penugasan pekerjaan",
      action: "Laporan",
      dialog: "Buat laporan pekerjaan",
    },
    {
      role: "field",
      section: "Tugas aktif saya",
      action: "Laporan",
      dialog: "Buat laporan pekerjaan",
    },
    {
      role: "finance",
      section: "Posisi piutang",
      action: "Invoice",
      dialog: "Buat draft invoice",
    },
    {
      role: "sales",
      section: "Pipeline penawaran",
      action: "Order",
      dialog: "Catat permintaan order",
    },
  ];
  const sections: string[] = [];
  for (const entry of cases) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    try {
      await login(page, entry.role);
      await expect(page.locator(".sgi-homepage")).toHaveAttribute(
        "data-workspace-role",
        entry.role,
      );
      await expect(
        page
          .getByRole("main")
          .getByRole("heading", { name: "SGI One · Homepage", exact: true }),
      ).toBeVisible();
      // Each workspace renders a different set of real task sections.
      sections.push(
        (await page.locator(".home-notice h2").allTextContents()).join("|"),
      );
      const nav = page.getByRole("navigation", {
        name: "Navigasi bawah",
        exact: true,
      });
      await expect(nav.getByRole("link")).toHaveCount(4);
      await expect(nav.getByRole("button")).toHaveCount(1);
      await expect(nav.locator(".mobile-main-button")).toHaveAttribute(
        "aria-label",
        entry.action,
      );
      for (const width of [320, 390, 639]) {
        await page.setViewportSize({ width, height: 844 });
        await overflow(page);
        const bar = (await nav.boundingBox())!;
        const central = (await nav
          .locator(".mobile-main-button")
          .boundingBox())!;
        expect(bar.x).toBeGreaterThan(0);
        expect(bar.y + bar.height).toBeLessThan(844);
        expect(central.y).toBeLessThan(bar.y);
        await expect(page.locator(".sgi-sidebar")).toHaveCount(0);
        const content = (await page.getByRole("main").boundingBox())!;
        expect(content.y + content.height).toBeLessThanOrEqual(central.y - 6);
        expect(
          await page.locator(".home-all-features .home-shortcut").count(),
        ).toBeGreaterThan(1);
        expect(
          await page.locator(".home-all-features .home-shortcut svg").count(),
        ).toBe(await page.locator(".home-all-features .home-shortcut").count());
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator(".home-refresh button").click();
      await expect(page.locator(".loading-state")).toHaveCount(0);
      const lastAction = (await page
        .locator(".home-refresh button")
        .boundingBox())!;
      const scrollArea = (await page.getByRole("main").boundingBox())!;
      expect(lastAction.y + lastAction.height).toBeLessThanOrEqual(
        scrollArea.y + scrollArea.height + 1,
      );
      await page
        .getByRole("heading", { name: "SGI One · Homepage", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `artifacts/screenshots/role-${entry.role}-mobile.png`,
      });
      if (entry.dialog) {
        await nav.locator(".mobile-main-button").click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await overflow(page);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toBeHidden();
        await nav.locator(".mobile-main-button").click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await page.goto("/home");
        await expect(page.locator(".loading-state")).toHaveCount(0);
      }
      for (const width of [640, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(page.locator(".sgi-homepage")).toHaveCount(0);
        await expect(
          page.getByRole("complementary", {
            name: "Navigasi SGI",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page
            .getByRole("main")
            .getByRole("heading", { name: "Dashboard", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: entry.section, exact: true }),
        ).toBeVisible();
        await expect(nav).toBeHidden();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
      }
      await page.screenshot({
        path: `artifacts/screenshots/role-${entry.role}-desktop.png`,
        fullPage: true,
      });
    } finally {
      await context.close();
    }
  }
  expect(new Set(sections).size).toBe(6);
});
test("global search opens real records and mobile photo reports persist privately", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "field");
  const jobs = (await (await page.request.get("/api/data/jobs")).json()).rows;
  const job = jobs.find(
    (j: { status: string }) => !["completed", "cancelled"].includes(j.status),
  );
  expect(job).toBeTruthy();
  await page
    .getByRole("button", { name: "Buka pencarian global", exact: true })
    .click();
  const search = page.getByRole("combobox", {
    name: "Cari fitur dan data SGI",
  });
  await search.fill(job.number);
  const result = page
    .getByRole("option")
    .filter({ hasText: job.number })
    .first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(new RegExp(`/jobs/${job.id}\\?role=field$`));
  await page.goto(`/reports?create=1&job=${job.id}`);
  const dialog = page.getByRole("dialog", {
    name: "Buat laporan pekerjaan",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const note = `Laporan foto demonstrasi ${Date.now()}: kendaraan tiba di gudang.`;
  await dialog.getByLabel("Catatan pekerjaan", { exact: true }).fill(note);
  const image = readFileSync("public/sgi-logo.png");
  await dialog.getByLabel(/^Foto laporan/).setInputFiles({
    name: "foto-demo.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(
    dialog.getByAltText("Pratinjau foto yang akan dilampirkan"),
  ).toBeVisible();
  await overflow(page);
  await dialog
    .getByRole("button", { name: "Kirim laporan", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(note, { exact: true })).toBeVisible();
  const rows = (await (await page.request.get("/api/data/reports")).json())
    .rows;
  const report = rows.find((r: { note: string }) => r.note === note);
  expect(report.hasPhoto).toBe(true);
  const photo = await page.request.get(`/api/reports/${report.id}/photo`);
  expect(photo.ok()).toBe(true);
  expect(await photo.body()).toEqual(image);
  const panel = page.locator(".section-panel").filter({ hasText: note });
  await panel.getByRole("button", { name: /Lihat foto/ }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Foto laporan", exact: true })
      .getByRole("img", { name: `Foto pekerjaan ${job.number}`, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/screenshots/mobile-report-photo.png",
  });
  const other = await browser.newContext();
  try {
    const second = await other.newPage();
    await login(second, "field2");
    expect(
      (await second.request.get(`/api/reports/${report.id}/photo`)).status(),
    ).toBe(404);
    const found = await (
      await second.request.get(
        `/api/search?q=${encodeURIComponent(job.number)}`,
      )
    ).json();
    expect(found.results).toEqual([]);
    expect(
      (await second.request.get("/api/data/dashboard?role=finance")).status(),
    ).toBe(403);
  } finally {
    await other.close();
  }
});

test("homepage controls persist preferences and map coordinates use the real scoped backend", async ({
  page,
  browser,
}) => {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "operations");
  await expect(
    page.getByRole("complementary", { name: "Navigasi SGI", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".topbar")).toHaveCount(0);
  await expect(page.locator(".home-summary-grid>a")).toHaveCount(2);
  await expect(page.locator(".home-status-grid>a")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Pemberitahuan pekerjaan", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Perlu perhatian", exact: true }),
  ).toContainText("Perlu review");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Atur favorit", exact: true }).click();
  const favorites = page.getByRole("dialog", {
    name: "Menu favorit",
    exact: true,
  });
  await favorites
    .getByRole("checkbox", { name: "Peta pekerjaan", exact: true })
    .uncheck();
  await favorites.getByRole("checkbox", { name: /^Absensi|^Absen/ }).check();
  await favorites
    .getByRole("button", { name: "Simpan favorit", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".loading-state")).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Menu favorit", exact: true })
      .getByRole("link", { name: /^Absensi|^Absen/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tutup ringkasan perhatian", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".home-notice")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Pengaturan homepage dan akun", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tampilkan ringkasan perhatian", exact: true })
    .click();
  await expect(page.locator(".home-notice")).toBeVisible();
  await page
    .locator(".home-status-grid")
    .getByRole("link", { name: /Berjalan/ })
    .click();
  await expect(page).toHaveURL(/status=in_progress/);
  await expect(
    page.getByRole("combobox", { name: "Filter status", exact: true }),
  ).toContainText("Dalam proses");
  await expect(
    page.getByRole("textbox", { name: "Cari data", exact: true }),
  ).toHaveValue("");
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Distribusi status", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".chart-accessible-summary")).toContainText(
    "Dalam proses",
  );
  await expect(
    page.locator(".role-dashboard-content canvas").first(),
  ).toBeVisible();
  const payload = await (await page.request.get("/api/maps")).json();
  const job = payload.rows.find((j: { location: unknown }) => j.location);
  expect(job).toBeTruthy();
  await page.goto("/maps");
  const row = page.locator(".map-job-row").filter({ hasText: job.number });
  await row.getByRole("button", { name: "Ubah lokasi", exact: true }).click();
  const editor = page.getByRole("dialog", {
    name: "Koordinat asal dan tujuan",
    exact: true,
  });
  await editor
    .getByLabel("Latitude asal", { exact: true })
    .fill(String(job.location.originLat));
  await editor
    .getByRole("button", { name: "Simpan koordinat", exact: true })
    .click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole("status")).toContainText("Koordinat tersimpan");
  await page.reload();
  await expect(row).toContainText(String(job.location.originLat));
  await overflow(page);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    const second = await context.newPage();
    await second.route("https://tile.openstreetmap.org/**", (route) =>
      route.abort(),
    );
    await login(second, "field");
    await second.goto("/maps");
    await expect(second.locator(".loading-state")).toHaveCount(0);
    await expect(
      second.getByRole("button", { name: /Ubah lokasi|Tetapkan lokasi/ }),
    ).toHaveCount(0);
    expect(
      (
        await second.request.post(`/api/jobs/${job.id}/location`, {
          headers: { Origin: "http://localhost:4310" },
          data: {
            originLat: 0,
            originLng: 0,
            destinationLat: 0,
            destinationLng: 0,
          },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await context.close();
  }
});

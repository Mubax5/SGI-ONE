import { test, expect, Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
const modules = [
  "analytics",
  "maps",
  "customers",
  "requests",
  "quotations",
  "jobs",
  "documents",
  "reports",
  "billing",
  "invoices",
  "payments",
  "attendance",
  "users",
  "audit",
];
async function assertNoHorizontalOverflow(page: Page) {
  const offenders = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        ".table-scroll,.responsive-table,.print-table,.cell-content,.row-actions,[role=dialog]",
      ),
    )
      .filter(
        (e) =>
          e.getBoundingClientRect().width > 0 &&
          e.scrollWidth > e.clientWidth + 2,
      )
      .map((e) => ({
        tag: e.tagName,
        classes: e.className,
        width: e.clientWidth,
        scroll: e.scrollWidth,
        text: e.textContent?.slice(0, 70),
      })),
  );
  expect(offenders).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
});

test("SGI brand, distinct menu icons and all modules reflow without side scrolling", async ({
  page,
  browser,
}) => {
  test.setTimeout(360000);
  mkdirSync("artifacts/screenshots", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Masuk", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .getByRole("button", { name: "Masuk", exact: true })
      .evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toBe("rgb(255, 77, 10)");
  expect(
    await page
      .getByRole("button", { name: "Masuk", exact: true })
      .evaluate((e) => getComputedStyle(e).color),
  ).toBe("rgb(17, 17, 17)");
  expect(await page.locator(".login-story").count()).toBe(0);
  await page.screenshot({
    path: "artifacts/screenshots/ui-auth-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: "artifacts/screenshots/ui-auth-mobile.png",
    fullPage: true,
  });
  await page.getByLabel("Email", { exact: true }).fill("admin@sgi.demo");
  await page
    .getByLabel("Kata sandi", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/home/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/analytics");
  const sidebar = page.getByRole("complementary", {
    name: "Navigasi SGI",
    exact: true,
  });
  const icons: string[] = [];
  for (const module of modules) {
    const link = sidebar.locator('a[href="/' + module + '"]');
    await expect(link.locator("svg")).toHaveCount(1);
    icons.push(await link.locator("svg").evaluate((e) => e.innerHTML));
  }
  expect(new Set(icons).size).toBe(modules.length);
  for (const module of modules) {
    await page.goto("/" + module);
    await expect(page.locator(".loading-state")).toHaveCount(0);
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toBeVisible();
    const heading = page.getByRole("main").getByRole("heading", { level: 1 });
    await expect(heading).toHaveCSS(
      "font-size",
      module === "analytics" ? "30px" : "20px",
    );
    await expect(heading).toHaveCSS(
      "line-height",
      module === "analytics" ? "36px" : "25px",
    );
    await expect(heading).toHaveCSS("font-weight", "600");
    await page.screenshot({
      path: "artifacts/screenshots/ui-" + module + "-desktop.png",
      fullPage: true,
    });
  }
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const module of modules) {
      await page.goto("/" + module);
      await expect(page.locator(".loading-state")).toHaveCount(0);
      const bottomNav = page.getByRole("navigation", {
        name: "Navigasi bawah",
        exact: true,
      });
      if (width < 640) await expect(bottomNav).toBeVisible();
      else {
        await expect(bottomNav).toBeHidden();
        await expect(sidebar).toBeVisible();
      }
      const heading = page.getByRole("main").getByRole("heading", { level: 1 });
      await expect(heading).toHaveCSS(
        "font-size",
        module === "analytics" ? (width < 640 ? "24px" : "30px") : "20px",
      );
      await assertNoHorizontalOverflow(page);
      const labels = await page
        .locator(".responsive-table tbody tr")
        .first()
        .locator(".mobile-field-label")
        .count();
      if (
        width < 640 &&
        (await page.locator(".responsive-table tbody tr").count())
      )
        expect(labels).toBeGreaterThan(0);
      if (width === 390)
        await page.screenshot({
          path: "artifacts/screenshots/ui-" + module + "-mobile.png",
          fullPage: true,
        });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const bottom = page.getByRole("navigation", {
    name: "Navigasi bawah",
    exact: true,
  });
  await bottom.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Semua menu", exact: true });
  await expect(menu.getByRole("link")).toHaveCount(modules.length + 1);
  const tileWidths = await menu
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => link.getBoundingClientRect().width),
    );
  expect(Math.max(...tileWidths) - Math.min(...tileWidths)).toBeLessThan(1);
  expect(
    new Set(
      await menu
        .locator("a svg")
        .evaluateAll((icons) => icons.map((icon) => icon.innerHTML)),
    ).size,
  ).toBe(modules.length + 1);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: "artifacts/screenshots/ui-mobile-menu.png",
    fullPage: true,
  });
  await menu.getByRole("link", { name: "Invoice", exact: true }).click();
  await expect(page).toHaveURL(/invoices$/);
  await page
    .getByRole("row")
    .filter({ hasText: "INV-2026-00001" })
    .getByRole("button", { name: "Detail", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: "artifacts/screenshots/ui-invoice-detail-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.goto("/payments");
  await page
    .getByRole("row")
    .filter({ hasText: "DEMO-TRANSFER-001" })
    .getByRole("button", { name: "DEMO-TRANSFER-001", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Alokasi pembayaran");
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: "artifacts/screenshots/ui-payment-detail-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.goto("/audit");
  await page
    .getByRole("button", { name: "Perubahan", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.getByRole("tab", { name: "Data lengkap", exact: true }).click();
  await assertNoHorizontalOverflow(page);
  await page.keyboard.press("Escape");
  await page.goto("/customers");
  await page
    .getByRole("button", { name: "Tambah customer", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: "artifacts/screenshots/ui-form-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.goto("/jobs");
  await expect(page.locator(".loading-state")).toHaveCount(0);
  const jobHref = await page
    .getByRole("main")
    .locator('a.record-link[href^="/jobs/"]')
    .first()
    .getAttribute("href");
  await page.goto(jobHref!);
  await expect(page.locator(".loading-state")).toHaveCount(0);
  for (const tab of [
    "Dokumen & verifikasi",
    "Surat jalan digital",
    "Progres pekerjaan",
    "Kelayakan tagihan",
  ]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await assertNoHorizontalOverflow(page);
  }
  await page.screenshot({
    path: "artifacts/screenshots/ui-job-detail-mobile.png",
    fullPage: true,
  });
  const invoices = await page.request
    .get("/api/data/invoices")
    .then((r) => r.json());
  const invoice = invoices.rows.find(
    (i: { number: string }) => i.number === "INV-2026-00001",
  );
  const staticContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
    storageState: await page.context().storageState(),
  });
  try {
    const staticPage = await staticContext.newPage();
    await staticPage.goto(`/invoices/${invoice.id}/print`);
    await assertNoHorizontalOverflow(staticPage);
    await staticPage.screenshot({
      path: "artifacts/screenshots/ui-invoice-print-mobile-ssr.png",
      fullPage: true,
    });
  } finally {
    await staticContext.close();
  }
  await page.goto(`/invoices/${invoice.id}/print`);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: "artifacts/screenshots/ui-invoice-print-mobile.png",
    fullPage: true,
  });
  await page.goto("/customers");
  await bottom.getByRole("button", { name: "Menu", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    bottom.getByRole("button", { name: "Menu", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page).toHaveURL(/login$/);
  await page.getByLabel("Email", { exact: true }).fill("sales@sgi.demo");
  await page
    .getByLabel("Kata sandi", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/home$/);
  await expect(bottom.getByRole("link")).toHaveCount(4);
  await expect(
    bottom.getByRole("link", { name: "Home", exact: true }),
  ).toBeVisible();
  await expect(
    bottom.getByRole("link", { name: "Order", exact: true }),
  ).toBeVisible();
  await expect(
    bottom.getByRole("link", { name: "Analitik", exact: true }),
  ).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await bottom.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(menu.getByRole("link")).toHaveCount(6);
  await expect(
    menu.getByRole("link", { name: "Invoice", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
});

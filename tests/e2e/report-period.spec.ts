import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
test("FR-12 Kumo calendar applies real WIB periods, validates input, exports the same report and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("director@sgi.demo");
  await page
    .getByLabel("Kata sandi", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/home$/);
  await expect(page.locator(".loading-state")).toHaveCount(0);
  await page.goto("/analytics");
  await expect(page.locator(".loading-state")).toHaveCount(0);
  const trigger = page.getByRole("button", {
    name: "Pilih periode laporan",
    exact: true,
  });
  const popup = page.getByRole("dialog", {
    name: "Periode laporan",
    exact: true,
  });
  await trigger.click();
  await expect(popup).toBeVisible();
  await popup.getByLabel("Dari", { exact: true }).fill("2026-01-31");
  await popup.getByLabel("Sampai", { exact: true }).fill("2026-01-01");
  let reportRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/data/dashboard")) reportRequests++;
  });
  await popup
    .getByRole("button", { name: "Terapkan periode", exact: true })
    .click();
  await expect(popup).toContainText(
    "Tanggal akhir harus sama dengan atau sesudah tanggal awal.",
  );
  expect(reportRequests).toBe(0);
  await popup.getByLabel("Dari", { exact: true }).fill("2026-01-01");
  await popup.getByLabel("Sampai", { exact: true }).fill("2026-01-31");
  await popup.getByLabel("Dari", { exact: true }).fill("2026-01-10");
  await popup.getByLabel("Sampai", { exact: true }).fill("2026-01-10");
  await popup
    .getByRole("button", { name: "Selasa, 20 Januari 2026", exact: true })
    .click();
  await expect(popup.getByLabel("Dari", { exact: true })).toHaveValue(
    "2026-01-10",
  );
  await expect(popup.getByLabel("Sampai", { exact: true })).toHaveValue(
    "2026-01-20",
  );
  await popup.getByLabel("Dari", { exact: true }).fill("2026-01-01");
  await popup.getByLabel("Sampai", { exact: true }).fill("2026-01-31");
  const applied = page.waitForResponse((response) =>
    response
      .url()
      .endsWith("/api/data/dashboard?from=2026-01-01&to=2026-01-31"),
  );
  await popup
    .getByRole("button", { name: "Terapkan periode", exact: true })
    .click();
  const response = await applied;
  expect(response.ok()).toBe(true);
  const data = await response.json();
  expect(data.period).toEqual({
    from: "2025-12-31T17:00:00.000Z",
    to: "2026-01-31T16:59:59.999Z",
  });
  expect(data.jobsCreated).toBe(0);
  expect(
    data.currencies.every(
      (row: { billed: number; receipts: number }) =>
        row.billed === 0 && row.receipts === 0,
    ),
  ).toBe(true);
  await expect(page.locator(".loading-state")).toHaveCount(0);
  await expect(trigger).toContainText("01 Jan 2026 – 31 Jan 2026");
  await expect(page.locator(".financial-summary")).toContainText("Rp 0");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Ekspor laporan", exact: true })
    .click();
  const downloaded = await downloading;
  const csv = readFileSync((await downloaded.path())!, "utf8");
  expect(csv).toContain(data.period.from);
  expect(csv).toContain(data.period.to);
  expect(csv).toContain('"IDR","0","0"');
  const invalid = await page.request.get(
    "/api/data/dashboard?from=2026-02-31&to=2026-03-31",
  );
  expect(invalid.status()).toBe(400);
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await trigger.click();
    await expect(popup).toBeVisible();
    const overflow = await popup.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.left < 0 ||
        bounds.right > innerWidth + 1 ||
        element.scrollWidth > element.clientWidth + 1
      );
    });
    expect(overflow).toBe(false);
    const bounds = await popup.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845);
    for (const action of ["Batal", "Terapkan periode"]) {
      const actionBounds = await popup
        .getByRole("button", { name: action, exact: true })
        .boundingBox();
      expect(actionBounds!.y).toBeGreaterThanOrEqual(0);
      expect(actionBounds!.y + actionBounds!.height).toBeLessThanOrEqual(845);
    }
    await popup.getByRole("button", { name: "Bulan ini", exact: true }).click();
    await expect(popup.getByLabel("Dari", { exact: true })).toHaveValue(/-01$/);
    await popup
      .getByRole("button", { name: "30 hari terakhir", exact: true })
      .click();
    const from = await popup.getByLabel("Dari", { exact: true }).inputValue();
    const to = await popup.getByLabel("Sampai", { exact: true }).inputValue();
    expect((new Date(to).getTime() - new Date(from).getTime()) / 86400000).toBe(
      29,
    );
    mkdirSync("artifacts/screenshots", { recursive: true });
    await page.screenshot({
      path: `artifacts/screenshots/ui-report-calendar-${width}.png`,
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await trigger.click();
  await popup.getByRole("button", { name: "Bulan ini", exact: true }).click();
  const monthly = page.waitForResponse((response) =>
    response.url().includes("/api/data/dashboard?from="),
  );
  await popup
    .getByRole("button", { name: "Terapkan periode", exact: true })
    .click();
  expect((await monthly).ok()).toBe(true);
  await expect(page.locator(".loading-state")).toHaveCount(0);
  await trigger.click();
  await page.screenshot({
    path: "artifacts/screenshots/ui-report-calendar-desktop.png",
    fullPage: false,
  });
  await popup.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(trigger).toBeFocused();
});

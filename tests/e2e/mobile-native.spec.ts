import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const roles = [
  { name: "operations", action: "Laporan" },
  { name: "field", action: "Laporan" },
  { name: "finance", action: "Invoice" },
  { name: "sales", action: "Order" },
  { name: "admin", action: "Pengguna" },
  { name: "director", action: "Laporan" },
] as const;

test("native mobile Kumo homepage has role-aware carousel, compact actions and floating navigation", async ({
  page,
}) => {
  test.setTimeout(180000);
  mkdirSync("artifacts/screenshots", { recursive: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("operations@sgi.demo");
  await page
    .getByLabel("Kata sandi", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/home/);

  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator(".sgi-mobile-home")).toBeVisible();
    const slides = page.locator(".sgi-mobile-slide");
    await expect(slides.first()).toBeVisible();

    // The carousel itself may overflow horizontally; the document must not.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);

    const labels = await page
      .locator(".sgi-mobile-quick-label")
      .evaluateAll((els) =>
        els.map((el) => {
          const style = getComputedStyle(el);
          return {
            wordBreak: style.wordBreak,
            wrap: style.whiteSpace,
            width: el.clientWidth,
          };
        }),
      );
    expect(labels.every((label) => label.wrap === "nowrap")).toBe(true);

    await page.screenshot({
      path: `artifacts/screenshots/sgi-mobile-home-${width}.png`,
      fullPage: true,
    });

    const nav = page.getByRole("navigation", { name: "Navigasi bawah" });
    const button = nav.locator(".mobile-main-button");
    await expect(button).toHaveAttribute("aria-label", "Laporan");
    const card = (await nav.boundingBox())!;
    expect(card.x).toBeGreaterThan(0);
    expect(card.x + card.width).toBeLessThan(width);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footer = (await page.locator(".sgi-mobile-footer-note").boundingBox())!;
    const floating = (await nav.boundingBox())!;
    expect(footer.y + footer.height).toBeLessThan(floating.y);
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  const dots = page.locator(".sgi-mobile-carousel-dots button");
  expect(await dots.count()).toBeGreaterThan(1);
  await dots.nth(1).click();
  await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");

  await page.goto("/home");
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator(".sgi-mobile-home")).toHaveCount(0);
  await expect(
    page.getByRole("main").getByRole("heading", { name: "Dashboard" }),
  ).toBeVisible();
});

test("six roles retain different center actions on the compact navbar", async ({
  browser,
}) => {
  test.setTimeout(240000);
  for (const role of roles) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    try {
      const page = await ctx.newPage();
      await page.goto("/login");
      await page.getByLabel("Email", { exact: true }).fill(`${role.name}@sgi.demo`);
      await page
        .getByLabel("Kata sandi", { exact: true })
        .fill(process.env.DEMO_PASSWORD!);
      await page.getByRole("button", { name: "Masuk", exact: true }).click();
      await expect(page).toHaveURL(/home/);
      await expect(page.locator(".sgi-mobile-home")).toHaveAttribute(
        "data-workspace-role",
        role.name,
      );
      await expect(
        page.getByRole("navigation", { name: "Navigasi bawah" }).locator(".mobile-main-button"),
      ).toHaveAttribute("aria-label", role.action);
    } finally {
      await ctx.close();
    }
  }
});

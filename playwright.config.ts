import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 30000 },
  reporter: "list",
  use: {
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:4310",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4310/login",
    reuseExistingServer: true,
    timeout: 120000,
  },
});

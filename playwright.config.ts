import { defineConfig, devices } from "@playwright/test";

const DB = process.env.E2E_DATABASE_URL ?? "postgres://postgres@localhost:5433/toon_e2e";
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/api/health`,
        timeout: 240_000,
        reuseExistingServer: true,
        env: { DATABASE_URL: DB, ADMIN_EMAILS: "boss@toon.test", PAYMENTS_PROVIDER: "test", APP_URL: `http://localhost:${PORT}`, ALLOW_LOCAL_MEDIA: "1", LOCAL_MEDIA_DIR: ".data/e2e-media", NEXT_DIST_DIR: ".next-e2e" },
      },
});

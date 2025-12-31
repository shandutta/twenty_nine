import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const serverPort = process.env.E2E_PORT ?? "3100";
const rawBaseUrl =
  process.env.PW_BASE_URL ??
  process.env.E2E_BASE_URL ??
  `http://127.0.0.1:${serverPort}`;
const baseURL = rawBaseUrl.replace(/\/game\/?$/, "").replace(/\/$/, "");
const useWebServer =
  !process.env.E2E_NO_WEBSERVER && !process.env.PW_EXTERNAL_SERVER;
const repoRoot = path.resolve(process.cwd(), "..", "..");

export default defineConfig({
  testDir: "./test/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/playwright/html", open: "never" }],
  ],
  outputDir: "reports/playwright/test-results",
  webServer: useWebServer
    ? {
        command: `pnpm -C apps/web dev -- --port ${serverPort}`,
        url: `http://127.0.0.1:${serverPort}`,
        cwd: repoRoot,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

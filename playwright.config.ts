import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    timeout: 240000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      NEXT_PUBLIC_SITE_URL: baseURL,
      E2E_DISABLE_EXTERNAL_BOUNDARIES: "1",
      PUBLIC_RATE_LIMIT_QUOTE_REQUEST_MAX: "100",
      PUBLIC_RATE_LIMIT_WHATSAPP_CLICK_MAX: "100",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

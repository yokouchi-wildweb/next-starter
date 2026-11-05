// playwright.config.ts
// 実際のブラウザの受入のテスト(e2e/)。dev server は自分で立てない: 人(または guild dev)が立てたサーバーを E2E_BASE_URL で指す
// (reuseExistingServer)。CI だけ webServer で立てる。手順: e2e/README.md

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  ...(process.env.CI ? { webServer: { command: "pnpm dev", url: baseURL, reuseExistingServer: true, timeout: 180_000 } } : {}),
});

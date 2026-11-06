// playwright.config.default.ts
// 実際のブラウザの受入のテスト(tests/e2e/<機能>/)の上流の設定。上流は素の playwright.config.ts を出さない(D171 の .default と素の組:
// 素の名前は fork の物。fork は自分の playwright.config.ts でこれを読んで足す)。上流の package.json の test:e2e:* は -c でこれを指す。
// dev server は自分で立てない: 人(または guild dev)が立てたサーバーを E2E_BASE_URL で指す(reuseExistingServer)。CI だけ webServer で立てる。
// 手順: tests/e2e/unsavedGuard/README.md

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
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

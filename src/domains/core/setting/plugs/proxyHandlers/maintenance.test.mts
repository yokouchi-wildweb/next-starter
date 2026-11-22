// src/domains/core/setting/plugs/proxyHandlers/maintenance.test.mts
// proxy の項目 maintenance(点 proxyHandlers、段 maintenance)の回帰テスト。DB は使わない(settingService をモックで差し替える)。
// メンテ中は bypass ロール(admin・debugger)だけ通す。停止中の管理者は ctx.user() が null なので入れない。許可パスは期間の判定を読まずに通す
// 実行: pnpm test src/domains/core/setting/plugs/proxyHandlers/maintenance.test.mts

import assert from "node:assert/strict";
import { join } from "node:path";
import { before, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

import { NextRequest } from "next/server";

import type { SessionUser } from "@/domains/core/auth/entities/session";
import type { ProxyContext, ProxyHandler } from "@/proxies/points";

const srcUrl = (rel: string) => pathToFileURL(join(process.cwd(), "src", rel)).href;

let maintenanceActive = true;
let maintenanceReads = 0;
mock.module(srcUrl("domains/core/setting/services/server/settingService.ts"), {
  namedExports: {
    settingService: {
      isMaintenanceActive: async () => {
        maintenanceReads += 1;
        return maintenanceActive;
      },
    },
  },
});

let handler: ProxyHandler;
before(async () => {
  ({ handler } = await import("./maintenance"));
});

const user = (role: string): SessionUser => ({ userId: `${role}-1`, role, status: "active", isDemo: false, providerType: "email", providerUid: "x", name: role }) as SessionUser;
const ctxOf = (value: SessionUser | null) => {
  const calls = { count: 0 };
  const ctx: ProxyContext = {
    user: async () => {
      calls.count += 1;
      return value;
    },
  };
  return { ctx, calls };
};
const req = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));
const location = (res: Response | void) => (res ? new URL(res.headers.get("location") ?? "").pathname : "pass");

test("maintenance: メンテ中は bypass ロールだけ通す(停止中の管理者は ctx.user() が null)、許可パスは利用者を見ない", async () => {
  maintenanceActive = true;
  assert.equal(location(await handler(req("/mypage"), ctxOf(user("admin")).ctx)), "pass");
  assert.equal(location(await handler(req("/mypage"), ctxOf(user("debugger")).ctx)), "pass");
  assert.equal(location(await handler(req("/mypage"), ctxOf(user("user")).ctx)), "/maintenance");
  assert.equal(location(await handler(req("/mypage"), ctxOf(null).ctx)), "/maintenance");
  const allowed = ctxOf(null);
  assert.equal(location(await handler(req("/login"), allowed.ctx)), "pass");
  assert.equal(allowed.calls.count, 0);

  // メンテ時間外: 利用者を見ず、/maintenance は終了後の行き先へ
  maintenanceActive = false;
  const off = ctxOf(null);
  assert.equal(location(await handler(req("/mypage"), off.ctx)), "pass");
  assert.equal(location(await handler(req("/maintenance"), off.ctx)), "/");
  assert.equal(off.calls.count, 0);
  maintenanceActive = true;
});

test("maintenance: 許可パスは期間の判定(DB の読み)をしない。/maintenance と許可外のパスは判定する", async () => {
  for (const active of [true, false]) {
    maintenanceActive = active;
    maintenanceReads = 0;
    assert.equal(location(await handler(req("/login"), ctxOf(null).ctx)), "pass");
    assert.equal(location(await handler(req("/api/health"), ctxOf(null).ctx)), "pass");
    assert.equal(maintenanceReads, 0);
    await handler(req("/maintenance"), ctxOf(null).ctx);
    await handler(req("/mypage"), ctxOf(null).ctx);
    assert.equal(maintenanceReads, 2);
  }
  maintenanceActive = true;
});

// src/proxies/proxy.test.mts
// proxy の主体(ctx.user)と、それを使う上流の handler の判定の回帰テスト。DB は使わない(解決器の部品と config をモックで差し替える)。
// - createProxyUser: 遅延(呼ばれなければ解決しない)・リクエスト内メモ化・利用可能な status だけ非 null・Cookie なし / DB 未構成は解決せず null
// - maintenance: メンテ中は bypass ロール(admin・debugger)だけ通す。停止中の管理者は ctx.user() が null なので入れない。許可パスは通す
// - demoMode: 有効時はデモ利用者だけ通す
// - redirect: guestOnly / authedOnly / allowRoles の判定。規則に当たらない住所では ctx.user() を呼ばない
// - 枠: 生成一覧の handler・decorator は骨組みの後で同じ ctx を受けて走り、骨組みが Response を返したら走らない
// 実行: pnpm test:proxy

import assert from "node:assert/strict";
import { join } from "node:path";
import { before, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

import { NextRequest } from "next/server";

import type { SessionUser } from "@/features/core/auth/entities/session";

import type { ProxyContext, ProxyHandler } from "./types";

const srcUrl = (rel: string) => pathToFileURL(join(process.cwd(), "src", rel)).href;

let maintenanceActive = true;
mock.module(srcUrl("features/core/setting/services/server/settingService.ts"), {
  namedExports: { settingService: { isMaintenanceActive: async () => maintenanceActive } },
});
mock.module(srcUrl("config/app/demo-mode.config.ts"), {
  namedExports: {
    demoModeConfig: { enabled: true, allowedPaths: ["/demo"], allowedPrefixes: ["/_next", "/api"], redirectTo: "/demo" },
  },
});
mock.module(srcUrl("config/app/redirect.config.ts"), {
  namedExports: {
    redirectRules: [
      { sourcePaths: ["/guest-only"], destination: "/mypage", guestOnly: true },
      { sourcePaths: ["/authed"], destination: "/home", authedOnly: true },
      { sourcePaths: ["/admins"], destination: "/admin", allowRoles: ["admin"] },
    ],
  },
});

// 枠の生成一覧を stub に(項目 1 つずつ。走った順と受けた ctx を記録)
const frameLog: string[] = [];
let seenCtx: unknown = null;
mock.module(srcUrl("proxies/extensions/handlers.ts"), {
  namedExports: {
    extensionHandlers: [
      async (_request: unknown, ctx: ProxyContext) => {
        frameLog.push("extension-handler");
        seenCtx = ctx;
        return undefined;
      },
    ],
  },
});
mock.module(srcUrl("proxies/extensions/decorators.ts"), {
  namedExports: {
    extensionDecorators: [
      (_request: unknown, _response: unknown, ctx: ProxyContext) => {
        frameLog.push("extension-decorator");
        assert.equal(ctx, seenCtx, "handler と decorator は同じ ctx を受ける");
      },
    ],
  },
});

let createProxyUser: typeof import("@/features/core/auth/services/server/proxyUserDeps").createProxyUser;
let maintenanceProxy: ProxyHandler;
let demoModeProxy: ProxyHandler;
let redirectProxy: ProxyHandler;
before(async () => {
  ({ createProxyUser } = await import("@/features/core/auth/services/server/proxyUserDeps"));
  ({ maintenanceProxy } = await import("./maintenance"));
  ({ demoModeProxy } = await import("./demoMode"));
  ({ redirectProxy } = await import("./redirect"));
  ({ default: proxy } = await import("../proxy"));
});
let proxy: (request: NextRequest) => Promise<Response>;

const user = (role: string, extra: Partial<SessionUser> = {}): SessionUser =>
  ({ userId: `${role}-1`, role, status: "active", isDemo: false, providerType: "email", providerUid: "x", name: role, ...extra }) as SessionUser;

/** 呼ばれた回数を数える ctx */
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

test("createProxyUser: 遅延・メモ化・利用可能な status だけ・Cookie なし / DB 未構成は解決しない", async () => {
  let resolves = 0;
  const deps = (stored: SessionUser | null, configured = true) => ({
    isConfigured: () => configured,
    readToken: (cookies: { get(name: string): { value?: string | null } | undefined }) => cookies.get("t")?.value ?? null,
    resolve: async () => {
      resolves += 1;
      return stored;
    },
    availableStatuses: ["active"] as const,
  });
  const cookies = (token?: string) => ({ get: (name: string) => (name === "t" && token ? { value: token } : undefined) });

  // 呼ばなければ解決しない
  createProxyUser(cookies("tok"), deps(user("admin")));
  assert.equal(resolves, 0);

  // 2 回呼んで解決は 1 回
  const get = createProxyUser(cookies("tok"), deps(user("admin")));
  assert.equal((await get())?.role, "admin");
  assert.equal((await get())?.role, "admin");
  assert.equal(resolves, 1);

  // 停止中・休会中は null
  for (const status of ["suspended", "inactive"]) {
    assert.equal(await createProxyUser(cookies("tok"), deps(user("admin", { status } as Partial<SessionUser>)))(), null, status);
  }

  // Cookie なし・DB 未構成は解決しない
  resolves = 0;
  assert.equal(await createProxyUser(cookies(), deps(user("admin")))(), null);
  assert.equal(await createProxyUser(cookies("tok"), deps(user("admin"), false))(), null);
  assert.equal(resolves, 0);
});

test("maintenance: メンテ中は bypass ロールだけ通す(停止中の管理者は ctx.user() が null)、許可パスは利用者を見ない", async () => {
  maintenanceActive = true;
  assert.equal(location(await maintenanceProxy(req("/mypage"), ctxOf(user("admin")).ctx)), "pass");
  assert.equal(location(await maintenanceProxy(req("/mypage"), ctxOf(user("debugger")).ctx)), "pass");
  assert.equal(location(await maintenanceProxy(req("/mypage"), ctxOf(user("user")).ctx)), "/maintenance");
  assert.equal(location(await maintenanceProxy(req("/mypage"), ctxOf(null).ctx)), "/maintenance");
  const allowed = ctxOf(null);
  assert.equal(location(await maintenanceProxy(req("/login"), allowed.ctx)), "pass");
  assert.equal(allowed.calls.count, 0);

  // メンテ時間外: 利用者を見ず、/maintenance は終了後の行き先へ
  maintenanceActive = false;
  const off = ctxOf(null);
  assert.equal(location(await maintenanceProxy(req("/mypage"), off.ctx)), "pass");
  assert.equal(location(await maintenanceProxy(req("/maintenance"), off.ctx)), "/");
  assert.equal(off.calls.count, 0);
  maintenanceActive = true;
});

test("demoMode: 有効時はデモ利用者だけ通す、許可パスは利用者を見ない", async () => {
  assert.equal(location(await demoModeProxy(req("/mypage"), ctxOf(user("user", { isDemo: true })).ctx)), "pass");
  assert.equal(location(await demoModeProxy(req("/mypage"), ctxOf(user("admin")).ctx)), "/demo");
  assert.equal(location(await demoModeProxy(req("/mypage"), ctxOf(null).ctx)), "/demo");
  const allowed = ctxOf(null);
  assert.equal(location(await demoModeProxy(req("/demo"), allowed.ctx)), "pass");
  assert.equal(allowed.calls.count, 0);
});

test("redirect: guestOnly・authedOnly・allowRoles の判定、規則に当たらない住所では利用者を見ない", async () => {
  assert.equal(location(await redirectProxy(req("/guest-only"), ctxOf(user("user")).ctx)), "/mypage");
  assert.equal(location(await redirectProxy(req("/guest-only"), ctxOf(null).ctx)), "pass");
  assert.equal(location(await redirectProxy(req("/authed"), ctxOf(user("user")).ctx)), "/home");
  assert.equal(location(await redirectProxy(req("/authed"), ctxOf(null).ctx)), "pass");
  assert.equal(location(await redirectProxy(req("/admins"), ctxOf(user("admin")).ctx)), "/admin");
  assert.equal(location(await redirectProxy(req("/admins"), ctxOf(user("user")).ctx)), "pass");
  const miss = ctxOf(user("admin"));
  assert.equal(location(await redirectProxy(req("/nothing-here"), miss.ctx)), "pass");
  assert.equal(miss.calls.count, 0);
});

test("枠: 生成一覧の項目は骨組みの後で走り、同じ ctx を受ける。骨組みが止めたら走らない", async () => {
  maintenanceActive = false;
  frameLog.length = 0;
  // demoMode のモックは有効なので、その許可接頭(/api)の住所で骨組みを素通りさせる
  const res = await proxy(req("/api/ping"));
  assert.equal(res.status, 200);
  assert.deepEqual(frameLog, ["extension-handler", "extension-decorator"]);
  assert.equal(typeof (seenCtx as ProxyContext).user, "function");

  // メンテ中・未ログイン → maintenance が redirect を返し、枠は走らない
  maintenanceActive = true;
  frameLog.length = 0;
  const blocked = await proxy(req("/some/page"));
  assert.equal(location(blocked), "/maintenance");
  assert.deepEqual(frameLog, []);
});

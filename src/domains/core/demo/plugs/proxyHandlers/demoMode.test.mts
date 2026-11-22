// src/domains/core/demo/plugs/proxyHandlers/demoMode.test.mts
// proxy の項目 demoMode(点 proxyHandlers、段 mode)の回帰テスト。デモの config をモックで差し替える。
// 有効時はデモ利用者だけ通す、許可パスは利用者を見ない(デモのページの機能 demoPages が開のとき。閉なら無効と同じ)
// 実行: pnpm test src/domains/core/demo/plugs/proxyHandlers/demoMode.test.mts

import assert from "node:assert/strict";
import { join } from "node:path";
import { before, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

import { NextRequest } from "next/server";

import type { SessionUser } from "@/domains/core/auth/entities/session";
import type { ProxyContext, ProxyHandler } from "@/proxies/points";

const srcUrl = (rel: string) => pathToFileURL(join(process.cwd(), "src", rel)).href;

mock.module(srcUrl("domains/core/demo/config.ts"), {
  namedExports: {
    demoConfig: { mode: { enabled: true, allowedPaths: ["/demo"], allowedPrefixes: ["/_next", "/api"], redirectTo: "/demo" } },
  },
});

let handler: ProxyHandler;
before(async () => {
  ({ handler } = await import("./demoMode"));
});

const user = (role: string, extra: Partial<SessionUser> = {}): SessionUser =>
  ({ userId: `${role}-1`, role, status: "active", isDemo: false, providerType: "email", providerUid: "x", name: role, ...extra }) as SessionUser;
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

test("demoMode: 有効時はデモ利用者だけ通す、許可パスは利用者を見ない(デモのページの機能 demoPages が開のとき。閉なら無効と同じ)", async () => {
  // 上流の既定は demoPages 閉(付け足しの機能は閉じて出荷、D115): 開けた間に確かめ、閉では転送しない
  const { overrideSwitches } = await import("@/featureGate/ruleList");
  const restore = overrideSwitches({ demoPages: true });
  try {
    assert.equal(location(await handler(req("/mypage"), ctxOf(user("user", { isDemo: true })).ctx)), "pass");
    assert.equal(location(await handler(req("/mypage"), ctxOf(user("admin")).ctx)), "/demo");
    assert.equal(location(await handler(req("/mypage"), ctxOf(null).ctx)), "/demo");
    const allowed = ctxOf(null);
    assert.equal(location(await handler(req("/demo"), allowed.ctx)), "pass");
    assert.equal(allowed.calls.count, 0);
  } finally {
    restore();
  }
  const closed = overrideSwitches({ demoPages: false });
  try {
    assert.equal(location(await handler(req("/mypage"), ctxOf(null).ctx)), "pass");
  } finally {
    closed();
  }
});

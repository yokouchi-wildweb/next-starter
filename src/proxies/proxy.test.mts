// src/proxies/proxy.test.mts
// proxy の骨組みの回帰テスト。ドメインは読まない(生成された一覧をモックの項目に差し替える)。項目ごとの判定は持ち主の隣のテスト
// (auth/plugs/proxyUser・setting/plugs/proxyHandlers/maintenance・demo/plugs/proxyHandlers/demoMode)。
// - redirect: guestOnly / authedOnly / allowRoles の判定。規則に当たらない住所では ctx.user() を呼ばない。同じ sourcePath の重複は止める
// - 鎖: 項目は段の並び(maintenance → mode → 骨組み gate・redirect → main)で走り、同じ ctx を受ける。前の段が Response を返したら後は走らない。
//   decorator は素通しのときだけ。ctx.user は点 proxyUser の項目が作る
// 実行: pnpm test src/proxies/proxy.test.mts

import assert from "node:assert/strict";
import { join } from "node:path";
import { before, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

import { NextRequest, NextResponse } from "next/server";

import type { ProxyContext, ProxyHandler, ProxyUser } from "./types";

const srcUrl = (rel: string) => pathToFileURL(join(process.cwd(), "src", rel)).href;
const entry = <T,>(name: string, plug: T, stage?: string) => ({ domain: null, name, requires: [], ...(stage ? { stage } : {}), plug });

mock.module(srcUrl("proxies/extensions/proxyRedirects.ts"), {
  namedExports: {
    proxyRedirects: [
      entry("guest", [{ sourcePaths: ["/guest-only"], destination: "/mypage", guestOnly: true }]),
      entry("members", [
        { sourcePaths: ["/authed"], destination: "/home", authedOnly: true },
        { sourcePaths: ["/admins"], destination: "/admin", allowRoles: ["admin"] },
      ]),
    ],
  },
});

// 鎖の項目を stub に(走った順と受けた ctx を記録)。block が真の間は段 maintenance の項目が /blocked へ転送する
const log: string[] = [];
let seenCtx: unknown = null;
let block = false;
const resolvedUser: { count: number } = { count: 0 };
mock.module(srcUrl("proxies/extensions/proxyHandlers.ts"), {
  namedExports: {
    proxyHandlers: [
      entry<ProxyHandler>("first", async (request, ctx) => {
        log.push("maintenance");
        seenCtx = ctx;
        return block ? NextResponse.redirect(new URL("/blocked", request.url)) : undefined;
      }, "maintenance"),
      entry<ProxyHandler>("mode", async () => {
        log.push("mode");
      }, "mode"),
      entry<ProxyHandler>("last", async (_request, ctx) => {
        log.push("main");
        assert.equal(ctx, seenCtx, "項目は同じ ctx を受ける");
      }, "main"),
    ],
  },
});
mock.module(srcUrl("proxies/extensions/proxyDecorators.ts"), {
  namedExports: {
    proxyDecorators: [
      entry("cookie", (_request: unknown, _response: unknown, ctx: ProxyContext) => {
        log.push("decorator");
        assert.equal(ctx, seenCtx, "handler と decorator は同じ ctx を受ける");
      }),
    ],
  },
});
mock.module(srcUrl("proxies/extensions/proxyUser.ts"), {
  namedExports: {
    proxyUser: [
      entry("session", {
        createUser: () => async () => {
          resolvedUser.count += 1;
          return null;
        },
      }),
    ],
  },
});

let redirectProxy: ProxyHandler;
let proxyHandlers: ProxyHandler[];
let proxy: (request: NextRequest) => Promise<Response>;
before(async () => {
  ({ redirectProxy } = await import("./redirect"));
  ({ proxyHandlers } = await import("./index"));
  ({ default: proxy } = await import("../proxy"));
});

const user = (role: string): ProxyUser => ({ userId: `${role}-1`, role, status: "active", isDemo: false }) as unknown as ProxyUser;

/** 呼ばれた回数を数える ctx */
const ctxOf = (value: ProxyUser | null) => {
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

test("redirect: 規則の組で同じ sourcePath が 2 つあると止める(どちらが効くかを並びで決めない)", async () => {
  const { flattenRedirectRules } = await import("./redirect");
  assert.deepEqual(
    flattenRedirectRules([[{ sourcePaths: ["/a"], destination: "/x" }], [{ sourcePaths: ["/b"], destination: "/y" }]]).map((r) => r.destination),
    ["/x", "/y"],
  );
  assert.throws(
    () => flattenRedirectRules([[{ sourcePaths: ["/a"], destination: "/x" }], [{ sourcePaths: ["/c", "/a"], destination: "/y" }]]),
    /sourcePath "\/a" が重複/,
  );
});

test("鎖: 段の並びで項目と骨組みが走る(maintenance → mode → gate → redirect → main)、decorator は素通しのときだけ、前の段が止めたら後は走らない", async () => {
  // 骨組みの 2 つ(門番・転送)は段 mode の項目と段 main の項目の間
  assert.equal(proxyHandlers.length, 5);
  assert.equal(proxyHandlers[3], redirectProxy);

  block = false;
  log.length = 0;
  resolvedUser.count = 0;
  const res = await proxy(req("/api/ping"));
  assert.equal(res.status, 200);
  assert.deepEqual(log, ["maintenance", "mode", "main", "decorator"]);
  assert.equal(typeof (seenCtx as ProxyContext).user, "function");
  assert.equal(resolvedUser.count, 0, "ctx.user() を呼ぶ項目が無ければ利用者を解かない");

  block = true;
  log.length = 0;
  const blocked = await proxy(req("/some/page"));
  assert.equal(location(blocked), "/blocked");
  assert.deepEqual(log, ["maintenance"]);
});

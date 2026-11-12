// src/app/api/admin/messaging/overrides/route.test.mts
// /api/admin/messaging/overrides(と /[key])の検査(Factory・門・messaging の service は偽物)。
// - 宣言: 全部の口が access { roleCategories: ["admin"] }
// - 門 messagingOverrides が閉なら 404 で service を呼ばない
// - 一覧 / 1 件 / PUT(body をそのまま)/ DELETE(?field= 必須、無ければ 400)
// 実行: pnpm test src/app/api/admin/messaging/overrides/route.test.mts

import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { NextRequest, NextResponse } from "next/server";

const { DomainError } = await import("@/lib/errors");

// createApiRoute の偽物: 宣言を記録し、返り値を JSON に、DomainError を status の JSON にする
const declared: { operation: string; access: unknown }[] = [];
type Handler = (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<unknown>;
const createApiRoute =
  (options: { operation: string; access: unknown }, handler: Handler) => {
    declared.push({ operation: options.operation, access: options.access });
    return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
      try {
        return NextResponse.json(await handler(req, { params: await ctx.params }));
      } catch (error) {
        if (error instanceof DomainError) return NextResponse.json({ message: error.message }, { status: error.status });
        throw error;
      }
    };
  };
mock.module("@/wiring/apiRoute", { namedExports: { createApiRoute } });

let gateOpen = true;
mock.module("@/featureGate", {
  namedExports: {
    gate: {
      assert: (name: string) => {
        assert.equal(name, "messagingOverrides");
        if (!gateOpen) throw new DomainError("not found", { status: 404 });
      },
    },
  },
});

const calls: unknown[][] = [];
mock.module("@/features/core/messaging/services/server/messagingService", {
  namedExports: {
    messagingService: {
      listMessageOverrides: async () => {
        calls.push(["list"]);
        return [{ key: "shop.notice" }];
      },
      getMessageOverrides: async (key: string) => {
        calls.push(["get", key]);
        return { key };
      },
      saveMessageOverride: async (key: string, body: unknown) => {
        calls.push(["save", key, body]);
        return { key };
      },
      resetMessageOverride: async (key: string, field: string) => {
        calls.push(["reset", key, field]);
        return { key };
      },
    },
  },
});

const list = await import("./route.ts");
const one = await import("./[key]/route.ts");

const BASE = "http://localhost/api/admin/messaging/overrides";
const params = (key: string) => ({ params: Promise.resolve({ key }) });

beforeEach(() => {
  gateOpen = true;
  calls.length = 0;
});

test("宣言: 全部の口が管理者だけ", () => {
  assert.equal(declared.length, 4);
  for (const entry of declared) assert.deepEqual(entry.access, { roleCategories: ["admin"] }, entry.operation);
});

test("一覧と 1 件", async () => {
  const res = await list.GET(new NextRequest(BASE), { params: Promise.resolve({}) });
  assert.deepEqual(await res.json(), { items: [{ key: "shop.notice" }] });
  const detail = await one.GET(new NextRequest(`${BASE}/shop.notice`), params("shop.notice"));
  assert.deepEqual(await detail.json(), { key: "shop.notice" });
  assert.deepEqual(calls, [["list"], ["get", "shop.notice"]]);
});

test("PUT は body をそのまま、DELETE は ?field= を渡す(無ければ 400)", async () => {
  const body = { fieldPath: "email.subject", value: "x" };
  await one.PUT(new NextRequest(`${BASE}/shop.notice`, { method: "PUT", body: JSON.stringify(body) }), params("shop.notice"));
  await one.DELETE(new NextRequest(`${BASE}/shop.notice?field=email.subject`, { method: "DELETE" }), params("shop.notice"));
  const missing = await one.DELETE(new NextRequest(`${BASE}/shop.notice`, { method: "DELETE" }), params("shop.notice"));
  assert.equal(missing.status, 400);
  assert.deepEqual(calls, [
    ["save", "shop.notice", body],
    ["reset", "shop.notice", "email.subject"],
  ]);
});

test("門が閉なら 404 で service を呼ばない", async () => {
  gateOpen = false;
  for (const res of [
    await list.GET(new NextRequest(BASE), { params: Promise.resolve({}) }),
    await one.GET(new NextRequest(`${BASE}/k.k`), params("k.k")),
    await one.PUT(new NextRequest(`${BASE}/k.k`, { method: "PUT", body: "{}" }), params("k.k")),
    await one.DELETE(new NextRequest(`${BASE}/k.k?field=a.b`, { method: "DELETE" }), params("k.k")),
  ]) {
    assert.equal(res.status, 404);
  }
  assert.equal(calls.length, 0);
});

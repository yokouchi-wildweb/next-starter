// src/app/api/admin/wallet/bulk/grant/route.test.mts
// POST /api/admin/wallet/bulk/grant の検査(Factory・walletService は偽物)。
// - 宣言: 管理者だけ、maxDuration 60
// - body を確かめてから、命令と同じ walletService.bulkGrant にそのまま渡す(dryRun・notify も)
// - 1 回の上限(userConfig.bulkUpdate.maxIds)を超える・理由が無い・額が正の整数でない・知らない種類は 400 で service を呼ばない
// - service の DomainError はその status で返る
// 実行: pnpm test src/app/api/admin/wallet/bulk/grant/route.test.mts

import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { NextRequest, NextResponse } from "next/server";

const { DomainError } = await import("@/lib/errors");

const declared: { operation: string; access: unknown }[] = [];
type Handler = (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<unknown>;
const createApiRoute = (options: { operation: string; access: unknown }, handler: Handler) => {
  declared.push({ operation: options.operation, access: options.access });
  return async (req: NextRequest) => {
    try {
      const result = await handler(req, { params: {} });
      return result instanceof Response ? result : NextResponse.json(result);
    } catch (error) {
      if (error instanceof DomainError) return NextResponse.json({ message: error.message }, { status: error.status });
      throw error;
    }
  };
};
mock.module("@/wiring/apiRoute", { namedExports: { createApiRoute } });
mock.module("@/domains/user/config", { namedExports: { userConfig: { bulkUpdate: { maxIds: 3 } } } });
mock.module("@/domains/wallet/config", { namedExports: { walletConfig: { currency: { point: {}, coin: {} } } } });

const calls: unknown[] = [];
let failure: Error | null = null;
mock.module("@/domains/core/wallet/services/server/walletService", {
  namedExports: {
    walletService: {
      bulkGrant: async (params: unknown) => {
        calls.push(params);
        if (failure) throw failure;
        return { dryRun: true, requestBatchId: null, granted: [], skipped: [], total: 0, notified: 0, notifyFailed: [] };
      },
    },
  },
});

const route = await import("./route.ts");

const URL = "http://localhost/api/admin/wallet/bulk/grant";
const post = (body: unknown) => new NextRequest(URL, { method: "POST", body: JSON.stringify(body) });
const valid = { walletType: "point", kind: "compensation", grants: [{ userId: "u1", amount: 100 }], reason: "障害のお詫び", notify: true, dryRun: true };

beforeEach(() => {
  calls.length = 0;
  failure = null;
});

test("宣言: 管理者だけ、maxDuration 60", () => {
  assert.deepEqual(declared, [{ operation: "POST /api/admin/wallet/bulk/grant", access: { roleCategories: ["admin"] } }]);
  assert.equal(route.maxDuration, 60);
});

test("確かめた body を walletService.bulkGrant にそのまま渡し、結果を返す", async () => {
  const response = await route.POST(post(valid));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [valid]);
  assert.equal((await response.json()).dryRun, true);
});

test("上限超え・理由なし・額の誤り・知らない種類・知らない通貨は 400 で service を呼ばない", async () => {
  const bad = [
    { ...valid, grants: [1, 2, 3, 4].map((n) => ({ userId: `u${n}`, amount: 1 })) },
    { ...valid, reason: "  " },
    { ...valid, grants: [{ userId: "u1", amount: 0 }] },
    { ...valid, grants: [{ userId: "u1", amount: 1.5 }] },
    { ...valid, kind: "refund" },
    { ...valid, walletType: "gold" },
    { ...valid, grants: [] },
  ];
  for (const body of bad) {
    const response = await route.POST(post(body));
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  assert.equal(calls.length, 0);
});

test("service の DomainError はその status で返る", async () => {
  failure = new DomainError("同じユーザーが 2 回並んでいます。", { status: 400 });
  const response = await route.POST(post(valid));
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /2 回/);
});

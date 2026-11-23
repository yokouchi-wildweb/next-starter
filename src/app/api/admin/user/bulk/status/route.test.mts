// src/app/api/admin/user/bulk/status/route.test.mts
// POST /api/admin/user/bulk/status の検査(Factory・userService は偽物)。
// - 宣言: 管理者だけ、maxDuration 60
// - body を確かめてから、命令と同じ userService.bulkChangeStatus にそのまま渡す(dryRun・onlyFrom も)。変えてよい先の判定はサービス
// - 1 回の上限(userConfig.bulkUpdate.maxIds)を超える・理由が無い・知らない状態は 400 で service を呼ばない
// - service の DomainError(一括で変えられない先など)はその status で返る
// 実行: pnpm test src/app/api/admin/user/bulk/status/route.test.mts

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

const calls: unknown[] = [];
let failure: Error | null = null;
mock.module("@/domains/core/user/services/server/userService", {
  namedExports: {
    userService: {
      bulkChangeStatus: async (params: unknown) => {
        calls.push(params);
        if (failure) throw failure;
        return { dryRun: true, changed: [], skipped: [], failed: [] };
      },
    },
  },
});

const route = await import("./route.ts");

const URL = "http://localhost/api/admin/user/bulk/status";
const post = (body: unknown) => new NextRequest(URL, { method: "POST", body: JSON.stringify(body) });
const valid = { userIds: ["u1", "u2"], newStatus: "suspended", reason: "規約違反", onlyFrom: "active", dryRun: true };

beforeEach(() => {
  calls.length = 0;
  failure = null;
});

test("宣言: 管理者だけ、maxDuration 60", () => {
  assert.deepEqual(declared, [{ operation: "POST /api/admin/user/bulk/status", access: { roleCategories: ["admin"] } }]);
  assert.equal(route.maxDuration, 60);
});

test("確かめた body を userService.bulkChangeStatus にそのまま渡し、結果を返す", async () => {
  const response = await route.POST(post(valid));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [valid]);
  assert.equal((await response.json()).dryRun, true);
});

test("上限超え・理由なし・知らない状態・空は 400 で service を呼ばない", async () => {
  const bad = [
    { ...valid, userIds: ["u1", "u2", "u3", "u4"] },
    { ...valid, reason: "" },
    { ...valid, newStatus: "sleeping" },
    { ...valid, onlyFrom: "sleeping" },
    { ...valid, userIds: [] },
  ];
  for (const body of bad) {
    const response = await route.POST(post(body));
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  assert.equal(calls.length, 0);
});

test("service の DomainError(一括で変えられない先など)はその status で返る", async () => {
  failure = new DomainError("一括で withdrawn には変えられません", { status: 400 });
  const response = await route.POST(post({ ...valid, newStatus: "withdrawn" }));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 1);
});

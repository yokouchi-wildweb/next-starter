// src/features/core/storageObject/readRoute.test.mts
// GET /api/storage/objects/[id] の応答ヘッダーの回帰テスト。
// 302 と失敗応答は private, no-store + Vary。失敗応答（401 / 404 / 500）には Location を付けない。
// サービスの判定結果だけをモックし、ルートファクトリーと応答の組み立ては実物を動かす。
// 実行: pnpm test:storage-object

import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { NextRequest } from "next/server";

type Resolution = { kind: "redirect"; url: string } | { kind: "unauthenticated" } | { kind: "not_found" };

let next: Resolution | Error = { kind: "not_found" };
let calledWith: string | null = null;

mock.module("@/features/core/storageObject/services/server/storageObjectService", {
  namedExports: {
    storageObjectService: {
      resolveRead: async (id: string) => {
        calledWith = id;
        if (next instanceof Error) throw next;
        return next;
      },
    },
  },
});
// 用途の登録表（server-only と各ドメインの判定関数を読む）はこのテストでは使わない
mock.module("@/features/core/storageObject/services/server/purposeSource", {
  namedExports: { getStoragePurposes: () => ({}) },
});
mock.module("@/features/core/storageObject/services/server/sweep", {
  namedExports: { runStorageSweep: async () => null },
});
mock.module("@/features/core/storageObject/services/server/crudBinding", {
  namedExports: { storageBindingFor: () => null },
});
mock.module("@/features/core/auth/services/server/session/getSessionUser", {
  namedExports: { getSessionUser: async () => null },
});
mock.module("@/features/core/auth/services/server/session/getTokenOnlySession", {
  namedExports: { getTokenOnlySession: async () => null },
});
mock.module("@/features/core/rateLimit/services/server/wrappers/rateLimitHelper", {
  namedExports: { checkRateLimit: async () => ({ allowed: true }) },
});

// node --test は引数をグロブとして読むため、角括弧のあるルートのフォルダには置かず、ここから import する
const { GET } = await import("@/app/api/storage/objects/[id]/route");

const ID = "01920000-0000-7000-8000-000000000001";

const call = (id: string) =>
  GET(new NextRequest(`http://localhost/api/storage/objects/${id}`), { params: Promise.resolve({ id }) });

function assertPrivateHeaders(res: Response) {
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.equal(res.headers.get("vary"), "Cookie, Authorization");
}

test("許可なら署名 URL へ 302（no-store + Vary）", async () => {
  next = { kind: "redirect", url: "https://storage.example.test/signed?generation=1" };
  const res = await call(ID);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://storage.example.test/signed?generation=1");
  assertPrivateHeaders(res);
  assert.equal(calledWith, ID);
});

test("ログインが要る用途で未ログインなら 401、Location なし", async () => {
  next = { kind: "unauthenticated" };
  const res = await call(ID);
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("location"), null);
  assertPrivateHeaders(res);
});

test("拒否・存在しないなら 404、Location なし", async () => {
  next = { kind: "not_found" };
  const res = await call(ID);
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("location"), null);
  assertPrivateHeaders(res);
});

test("ID の形式違いはサービスを呼ばずに 404", async () => {
  calledWith = null;
  next = { kind: "redirect", url: "https://storage.example.test/should-not-be-used" };
  const res = await call("not-a-uuid");
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("location"), null);
  assertPrivateHeaders(res);
  assert.equal(calledWith, null);
});

test("判定中の障害でも署名を返さない（500、Location なし、no-store）", async () => {
  next = new Error("db down");
  const res = await call(ID);
  assert.equal(res.status, 500);
  assert.equal(res.headers.get("location"), null);
  assertPrivateHeaders(res);
});

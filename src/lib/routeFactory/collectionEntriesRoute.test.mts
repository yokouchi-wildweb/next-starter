// src/lib/routeFactory/collectionEntriesRoute.test.mts
// GET /api/[domain]/collection-entries の認可（主の get の規則）と入力の回帰テスト。
// 登録表とセッションをモックして実際のルートを動かす（DB は使わない）。node --test の引数はグロブなので、角括弧のある
// ルートのフォルダではなくここに置き、ルートは相対パスで読む。
// 実行: pnpm test:collection-entries-route

import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { NextRequest } from "next/server";

// `export *` だけの index.ts は tsx の ESM 読み込みで名前を拾えないので、実装ファイルを直接読む
import { DomainError } from "@/lib/errors/domainError";

type FakeUser = { userId: string; role: string; status: string; isDemo: boolean };
let currentUser: FakeUser | null = null;
const calls: unknown[][] = [];

const ownerService = {
  collectionEntriesForParents: async (field: string, parentIds: string[]) => {
    calls.push([field, parentIds]);
    if (field !== "images") throw new DomainError(`集まりの項目 ${field} はありません`, { status: 404 });
    return Object.fromEntries(parentIds.map((id) => [id, [{ id: `${id}-c1`, value: "storage://pub/x.images/1.png", sort: "a0" }]]));
  },
};

const entry = (access: unknown) => ({ service: async () => ownerService, access, table: "owners", idColumn: "id" });

mock.module("@/registry/serviceRegistry", {
  namedExports: {
    serviceRegistry: {
      publicOwner: entry({ read: "public", write: { roleCategories: ["admin"] } }),
      adminOwner: entry({ read: { roleCategories: ["admin"] }, write: { roleCategories: ["admin"] } }),
      closedOwner: entry({ read: "none", write: "none" }),
      plainDomain: { service: async () => ({}), access: { read: "public", write: "none" }, table: "plains", idColumn: "id" },
    },
  },
});
mock.module("@/features/core/auth/services/server/session/getTokenOnlySession", {
  namedExports: { getTokenOnlySession: async () => currentUser },
});
mock.module("@/features/core/auth/services/server/session/getSessionUser", {
  namedExports: { getSessionUser: async () => currentUser },
});

const { GET } = await import("../../app/api/[domain]/collection-entries/route.ts");

const call = (domain: string, query: string) =>
  GET(new NextRequest(`http://localhost/api/${domain}/collection-entries?${query}`), { params: Promise.resolve({ domain }) });

test("主を読める人には、主の id ごとのエントリを返す（主の get の規則）", async () => {
  currentUser = null;
  calls.length = 0;
  const res = await call("publicOwner", "field=images&parentIds=p1,p2,p1");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(Object.keys(body), ["p1", "p2"]);
  assert.equal(body.p1[0].id, "p1-c1");
  assert.deepEqual(calls, [["images", ["p1", "p2"]]], "重複した id は 1 回にまとめる");
});

test("主を読めない人は拒否する（未ログイン 401、権限なし 403、閉じた主 404）。サービスは呼ばない", async () => {
  calls.length = 0;
  currentUser = null;
  assert.equal((await call("adminOwner", "field=images&parentIds=p1")).status, 401);
  currentUser = { userId: "u1", role: "user", status: "active", isDemo: false };
  assert.equal((await call("adminOwner", "field=images&parentIds=p1")).status, 403);
  assert.equal((await call("closedOwner", "field=images&parentIds=p1")).status, 404);
  assert.deepEqual(calls, []);
});

test("入力の誤りは 400、集まりの無いドメインと知らない項目は 404", async () => {
  currentUser = null;
  assert.equal((await call("publicOwner", "parentIds=p1")).status, 400);
  assert.equal((await call("publicOwner", "field=images")).status, 400);
  const many = Array.from({ length: 101 }, (_, i) => `p${i}`).join(",");
  assert.equal((await call("publicOwner", `field=images&parentIds=${many}`)).status, 400);
  assert.equal((await call("plainDomain", "field=images&parentIds=p1")).status, 404);
  assert.equal((await call("publicOwner", "field=unknown&parentIds=p1")).status, 404);
});

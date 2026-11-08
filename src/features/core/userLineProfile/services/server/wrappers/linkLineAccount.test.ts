// src/features/core/userLineProfile/services/server/wrappers/linkLineAccount.test.ts
//
// LINE 連携の書き込みの検査(DB なし。@/lib/drizzle の db を偽物に差し替える)。
// - 新規・同じ LINE の更新・別 LINE への切り替えの 3 経路で、書く値は userId / lineUserId / displayName だけ(プロフィール画像は持たない)
// - 別のユーザーに連携済みの LINE は 409
// 実行: pnpm test src/features/core/userLineProfile
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

type Row = Record<string, unknown>;
let selectResults: Row[][] = [];
let writes: Array<{ op: "insert" | "update"; values: Row }> = [];

const fakeDb = {
  select: () => ({ from: () => ({ where: () => ({ limit: async () => selectResults.shift() ?? [] }) }) }),
  update: () => ({
    set: (values: Row) => {
      writes.push({ op: "update", values });
      return { where: () => ({ returning: async () => [{ id: "p1", ...values }] }) };
    },
  }),
  insert: () => ({
    values: (values: Row) => {
      writes.push({ op: "insert", values });
      return { returning: async () => [{ id: "p1", ...values }] };
    },
  }),
};

mock.module("@/lib/drizzle", { namedExports: { db: fakeDb } });

let linkLineAccount: typeof import("./linkLineAccount").linkLineAccount;
before(async () => {
  ({ linkLineAccount } = await import("./linkLineAccount"));
});
beforeEach(() => {
  selectResults = [];
  writes = [];
});

test("新規の連携: userId / lineUserId / displayName だけを書く", async () => {
  selectResults = [[], []];
  await linkLineAccount("u1", "L1", { displayName: "たろう" });
  assert.deepEqual(writes, [{ op: "insert", values: { userId: "u1", lineUserId: "L1", displayName: "たろう" } }]);
});

test("同じユーザーの同じ LINE: 表示名だけを更新する", async () => {
  selectResults = [[{ id: "p1", userId: "u1", lineUserId: "L1" }]];
  await linkLineAccount("u1", "L1", { displayName: "じろう" });
  assert.deepEqual(writes, [{ op: "update", values: { displayName: "じろう" } }]);
});

test("別の LINE への切り替え: lineUserId と表示名を書く(表示名を渡さなければ null)", async () => {
  selectResults = [[], [{ id: "p1", userId: "u1", lineUserId: "L0" }]];
  await linkLineAccount("u1", "L2");
  assert.deepEqual(writes, [{ op: "update", values: { lineUserId: "L2", displayName: null } }]);
});

test("別のユーザーに連携済みの LINE は 409 で、何も書かない", async () => {
  selectResults = [[{ id: "p9", userId: "other", lineUserId: "L1" }]];
  await assert.rejects(() => linkLineAccount("u1", "L1"), (e: { status?: number }) => e.status === 409);
  assert.deepEqual(writes, []);
});

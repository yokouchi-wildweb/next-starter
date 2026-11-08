// src/features/core/userXProfile/services/server/wrappers/linkXAccount.test.ts
//
// X 連携の書き込みの検査(DB なし。db・監査・暗号化を偽物に差し替える)。
// - 新規・同じ X の更新・別 X への切り替えの 3 経路で、書く列はプロフィール(username / displayName)・暗号化したトークン・期限・スコープだけ(プロフィール画像は持たない)
// - 新規と切り替えは監査を 1 件記録し、スナップショットにトークンを含めない | 別のユーザーに連携済みの X は 409
// 実行: pnpm test src/features/core/userXProfile
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

type Row = Record<string, unknown>;
let selectResults: Row[][] = [];
let writes: Array<{ op: "insert" | "update"; values: Row }> = [];
let audits: Row[] = [];

const writer = {
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
const fakeDb = {
  ...writer,
  select: () => ({ from: () => ({ where: () => ({ limit: async () => selectResults.shift() ?? [] }) }) }),
  transaction: async (fn: (trx: typeof writer) => unknown) => fn(writer),
};

mock.module("@/lib/drizzle", { namedExports: { db: fakeDb } });
mock.module("@/lib/crypto", { namedExports: { encrypt: (s: string) => `enc(${s})` } });
mock.module("@/features/core/auditLog/services/server", {
  namedExports: { auditLogger: { record: async (entry: Row) => void audits.push(entry) } },
});

let linkXAccount: typeof import("./linkXAccount").linkXAccount;
before(async () => {
  ({ linkXAccount } = await import("./linkXAccount"));
});
beforeEach(() => {
  selectResults = [];
  writes = [];
  audits = [];
});

const options = {
  xUserId: "X1",
  username: "taro",
  displayName: "たろう",
  accessToken: "at",
  refreshToken: "rt",
  tokenExpiresAt: Date.UTC(2026, 0, 1),
  scopes: ["tweet.read"],
};
const tokenColumns = {
  accessTokenEncrypted: "enc(at)",
  refreshTokenEncrypted: "enc(rt)",
  tokenExpiresAt: new Date(Date.UTC(2026, 0, 1)),
  scopes: ["tweet.read"],
};

test("新規の連携: プロフィールとトークンだけを書き、監査を 1 件残す", async () => {
  selectResults = [[], []];
  await linkXAccount("u1", options);
  assert.deepEqual(writes, [
    { op: "insert", values: { userId: "u1", xUserId: "X1", username: "taro", displayName: "たろう", ...tokenColumns } },
  ]);
  assert.equal(audits.length, 1);
  assert.deepEqual(audits[0]?.after, { xUserId: "X1", username: "taro", displayName: "たろう" });
});

test("同じユーザーの同じ X: プロフィールとトークンを更新し、監査は残さない", async () => {
  selectResults = [[{ id: "p1", userId: "u1", xUserId: "X1" }]];
  await linkXAccount("u1", options);
  const { updatedAt, ...values } = writes[0]?.values ?? {};
  assert.ok(updatedAt instanceof Date);
  assert.deepEqual(values, { username: "taro", displayName: "たろう", ...tokenColumns });
  assert.equal(audits.length, 0);
});

test("別の X への切り替え: xUserId も書き、旧アカウントを before に監査を残す", async () => {
  selectResults = [[], [{ id: "p1", userId: "u1", xUserId: "X0", username: "old", displayName: "旧" }]];
  await linkXAccount("u1", options);
  const { updatedAt, ...values } = writes[0]?.values ?? {};
  assert.ok(updatedAt instanceof Date);
  assert.deepEqual(values, { xUserId: "X1", username: "taro", displayName: "たろう", ...tokenColumns });
  assert.deepEqual(audits[0]?.before, { xUserId: "X0", username: "old", displayName: "旧" });
});

test("別のユーザーに連携済みの X は 409 で、何も書かない", async () => {
  selectResults = [[{ id: "p9", userId: "other", xUserId: "X1" }]];
  await assert.rejects(() => linkXAccount("u1", options), (e: { status?: number }) => e.status === 409);
  assert.deepEqual(writes, []);
});

// src/domains/core/messaging/services/server/dispatchId.test.ts
//
// 送信の id の形の検査(DB なし。@/lib/drizzle の db を偽物に差し替える)。
// - isDispatchId: uuid の字面だけを通す(旧お知らせの写しの md5 由来の id も通す)。"send" など形の合わない字は通さない
// - 送信を id で引く store は、形の合わない id では DB を読まずに「無い」を返す(GET /api/admin/messaging/dispatches/send が
//   Postgres の 500 でなく、呼び手の「送信が見つかりません」404 になる。null → 404 は admin.test.ts・operations.test.ts が見る)
// 実行: pnpm test src/domains/core/messaging/services/server/dispatchId.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

const UUID = "0b9e6f3c-1d2a-4c5b-8e7f-123456789abc";
/** 旧お知らせの写しの id の形(md5 から作った uuid。版と variant の桁が RFC に従わない) */
const MD5_UUID = "9f86d081-884c-7d65-9a2f-eaa0c55ad015";

let dbUsed: string[] = [];
const row = { id: UUID, status: "completed", deleted_at: null };
const chain = (name: string, result: unknown[]) => {
  const step: Record<string, unknown> = {};
  for (const key of ["from", "where", "limit", "for"]) step[key] = () => step;
  step.then = (resolve: (value: unknown[]) => void) => {
    dbUsed.push(name);
    resolve(result);
  };
  return step;
};
const fakeDb = {
  select: () => chain("select", [row]),
  transaction: async (run: (tx: unknown) => Promise<unknown>) => run({ select: () => chain("tx.select", [row]) }),
};
mock.module("@/lib/drizzle", { namedExports: { db: fakeDb } });

let isDispatchId: typeof import("./dispatchId").isDispatchId;
let adminStore: typeof import("./admin/store").drizzleAdminDispatchStore;
let sendResultsStore: typeof import("./admin/store").drizzleSendResultsStore;
let operationsStore: typeof import("./admin/operationsStore").drizzleMessageOperationsStore;
before(async () => {
  ({ isDispatchId } = await import("./dispatchId"));
  ({ drizzleAdminDispatchStore: adminStore, drizzleSendResultsStore: sendResultsStore } = await import("./admin/store"));
  ({ drizzleMessageOperationsStore: operationsStore } = await import("./admin/operationsStore"));
});
beforeEach(() => {
  dbUsed = [];
});

test("isDispatchId: uuid の字面だけ(大文字・md5 由来も通す)", () => {
  assert.equal(isDispatchId(UUID), true);
  assert.equal(isDispatchId(UUID.toUpperCase()), true);
  assert.equal(isDispatchId(MD5_UUID), true);
  for (const bad of ["send", "", "d1", `${UUID}x`, ` ${UUID}`, UUID.replaceAll("-", ""), `{${UUID}}`]) {
    assert.equal(isDispatchId(bad), false, bad);
  }
});

test("読む口の store: 形の合わない id は DB を読まずに null(送信の詳細・配達・プレビュー・送信の結果の 404 の道)", async () => {
  assert.equal(await adminStore.findDispatch("send"), null);
  assert.equal(await sendResultsStore.findDispatch("send"), null);
  assert.deepEqual(dbUsed, []);
  assert.deepEqual(await adminStore.findDispatch(UUID), row);
  assert.deepEqual(dbUsed, ["select"]);
});

test("操作の store: 形の合わない id は行を読まずに null で渡す(削除・再送の 404 の道)、まとめての検索は外す", async () => {
  // run が受けた行を返り値で見る(配列に溜めると assert.deepEqual の型の絞りで後の push が型の誤りになる)
  const missing = await operationsStore.withLockedDispatch("send", async (_tx, dispatch) => dispatch);
  assert.equal(missing, null);
  assert.deepEqual(dbUsed, []);
  assert.deepEqual(await operationsStore.findDispatches(["send"]), []);
  assert.deepEqual(dbUsed, []);
  const found = await operationsStore.withLockedDispatch(UUID, async (_tx, dispatch) => dispatch);
  assert.deepEqual(found, row);
  assert.deepEqual(dbUsed, ["tx.select"]);
});

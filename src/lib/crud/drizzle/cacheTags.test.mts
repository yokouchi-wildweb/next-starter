// src/lib/crud/drizzle/cacheTags.ts のテスト(偽のサービス、札を捨てる関数は差し替え)。実行: pnpm test src/lib/crud/drizzle/cacheTags.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";

const { runWithCacheTags } = await import("@/lib/cacheTags/server");
const { applyCacheTags } = await import("./cacheTags.ts");

/** 書き込みのメソッドを持つ偽のサービス(呼び出しを記録し、決まった値を返す) */
function fakeService() {
  return {
    get: async (id: string) => ({ id }),
    create: async (data: { name: string }) => ({ id: "new-1", ...data }),
    update: async (id: string) => ({ id }),
    delete: async (_id: string) => {},
    bulkDeleteByIds: async (_ids: string[]) => {},
    bulkUpdate: async (records: { id: string }[]) => ({ results: records, count: records.length, notFoundIds: [] }),
    bulkUpsert: async (records: { id: string }[]) => ({ results: records, count: records.length }),
    duplicateWithIdMap: async (id: string) => ({ record: { id: `${id}-copy` }, idMaps: {} }),
    bulkUpdateByQuery: async () => ({ count: 3 }),
    replaceByQuery: async () => [],
    upsert: async () => {
      throw new Error("conflict");
    },
  };
}

/** 範囲を敷いて fn を走らせ、終わりに捨てた札を返す */
async function collect(fn: () => Promise<unknown>): Promise<string[]> {
  const seen: string[] = [];
  await runWithCacheTags(fn, { revalidate: (tag) => void seen.push(tag) }).catch(() => {});
  return seen;
}

test("id の分かる書き込み: ドメインの札 + 行の札(引数・戻り値・一括の ids・records・results・複製の record)", async () => {
  const s = applyCacheTags(fakeService(), { domain: "post" });
  assert.deepEqual(await collect(() => s.create({ name: "a" })), ["post", "post:new-1"]);
  assert.deepEqual(await collect(() => s.update("p1")), ["post", "post:p1"]);
  assert.deepEqual(await collect(() => s.delete("p2")), ["post", "post:p2"]);
  assert.deepEqual(await collect(() => s.bulkDeleteByIds(["a", "b"])), ["post", "post:a", "post:b"]);
  assert.deepEqual(await collect(() => s.bulkUpdate([{ id: "c" }])), ["post", "post:c"]);
  assert.deepEqual(await collect(() => s.bulkUpsert([{ id: "d" }, { id: "e" }])), ["post", "post:d", "post:e"]);
  assert.deepEqual(await collect(() => s.duplicateWithIdMap("f")), ["post", "post:f-copy"]);
});

test("id の分からない書き込み: ドメインの札 + 行の全部の札、空の ids はドメインの札だけ", async () => {
  const s = applyCacheTags(fakeService(), { domain: "post" });
  assert.deepEqual(await collect(() => s.bulkUpdateByQuery()), ["post", "post:*"]);
  assert.deepEqual(await collect(() => s.replaceByQuery()), ["post", "post:*"]);
  assert.deepEqual(await collect(() => s.bulkDeleteByIds([])), ["post"]);
});

test("throw でも積む: 戻り値から id を取る書き込みは行の全部の札に落とし、throw はそのまま", async () => {
  const s = applyCacheTags(fakeService(), { domain: "post" });
  const seen: string[] = [];
  await assert.rejects(runWithCacheTags(() => s.upsert(), { revalidate: (tag) => void seen.push(tag) }), /conflict/);
  assert.deepEqual(seen, ["post", "post:*"]);
});

test("読みは包まない・option 無しは何もしない・手動の markCacheTags", async () => {
  const s = applyCacheTags(fakeService(), { domain: "post" });
  assert.deepEqual(await collect(() => s.get("x")), []);
  assert.deepEqual(await collect(async () => s.markCacheTags(["x", 2])), ["post", "post:x", "post:2"]);
  assert.deepEqual(await collect(async () => s.markCacheTags()), ["post", "post:*"]);
  const plain = applyCacheTags(fakeService(), undefined);
  assert.deepEqual(await collect(() => plain.update("p1")), []);
  assert.deepEqual(await collect(async () => plain.markCacheTags(["x"])), []);
  assert.throws(() => applyCacheTags(fakeService(), { domain: "" }), /domain が空/);
});

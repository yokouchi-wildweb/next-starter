// src/lib/cacheTags のテスト(revalidate は deps で差し替える)。実行: pnpm test src/lib/cacheTags
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

// next/cache は Next の要求の外では読めない(既定の revalidate は使わない)
mock.module("next/cache", { namedExports: { revalidateTag: () => {} } });

const { cacheRowsTagOf, cacheTagOf, markCacheTags, readThrough, runWithCacheTags } = await import("./server.ts");
const { DomainError } = await import("@/lib/errors");

let warns: string[] = [];
let errors: string[] = [];
beforeEach(() => {
  warns = [];
  errors = [];
  mock.method(console, "warn", (line: string) => warns.push(line));
  mock.method(console, "error", (line: string) => errors.push(line));
});
afterEach(() => mock.restoreAll());

const recorder = () => {
  const seen: string[] = [];
  return { seen, revalidate: (tag: string) => void seen.push(tag) };
};

test("cacheTagOf・cacheRowsTagOf: ドメインの札・行の札・行の全部の札、空・: 入り・id \"*\"・256 字超は投げる", () => {
  assert.equal(cacheTagOf("post"), "post");
  assert.equal(cacheTagOf("post", "a1"), "post:a1");
  assert.equal(cacheTagOf("post", 42), "post:42");
  assert.throws(() => cacheTagOf(""), /domain が空/);
  assert.throws(() => cacheTagOf("post", ""), /id が空/);
  assert.throws(() => cacheTagOf("a:b"), /":" は使えません/);
  assert.equal(cacheTagOf("p", "x".repeat(254)).length, 256);
  assert.throws(() => cacheTagOf("p", "x".repeat(255)), /256 字を超えます/);
  assert.equal(cacheRowsTagOf("post"), "post:*");
  assert.throws(() => cacheTagOf("post", "*"), /行の全部の札の印/);
  assert.throws(() => cacheRowsTagOf(""), /domain が空/);
});

test("runWithCacheTags: 積んだ札を終わりにまとめて捨てる(重複は 1 つ、空は無視)、fn の値を返す", async () => {
  const r = recorder();
  const value = await runWithCacheTags(async () => {
    markCacheTags("post", "post:1");
    await Promise.resolve();
    markCacheTags("post", "", "user:9");
    assert.deepEqual(r.seen, [], "fn の途中では捨てない");
    return "ok";
  }, r);
  assert.equal(value, "ok");
  assert.deepEqual(r.seen, ["post", "post:1", "user:9"]);
  assert.deepEqual(warns, []);
});

test("runWithCacheTags: fn が throw しても積んだ分は捨て、throw はそのまま返す", async () => {
  const r = recorder();
  await assert.rejects(
    runWithCacheTags(() => {
      markCacheTags("order:3");
      throw new Error("boom");
    }, r),
    /boom/,
  );
  assert.deepEqual(r.seen, ["order:3"]);
});

test("runWithCacheTags: 入れ子は外側に積み、外側の終わりに 1 回だけ捨てる", async () => {
  const outer = recorder();
  const inner = recorder();
  await runWithCacheTags(async () => {
    markCacheTags("a");
    await runWithCacheTags(() => markCacheTags("b", "a"), inner);
    assert.deepEqual(outer.seen, [], "内側の終わりでは捨てない");
  }, outer);
  assert.deepEqual(inner.seen, []);
  assert.deepEqual(outer.seen, ["a", "b"]);
});

test("runWithCacheTags: 札が無ければ revalidate を呼ばない", async () => {
  const r = recorder();
  await runWithCacheTags(() => 1, r);
  assert.deepEqual(r.seen, []);
});

test("runWithCacheTags: 捨てるのに失敗しても要求は成功、残りの札も捨て、記録の 1 行(console.error の JSON)", async () => {
  const seen: string[] = [];
  const value = await runWithCacheTags(
    () => {
      markCacheTags("x", "y", "z");
      return "done";
    },
    {
      revalidate: (tag) => {
        seen.push(tag);
        if (tag === "y") throw new Error("Invariant: revalidateTag outside a request");
      },
    },
  );
  assert.equal(value, "done");
  assert.deepEqual(seen, ["x", "y", "z"]);
  assert.equal(errors.length, 1);
  const line = JSON.parse(errors[0]!);
  assert.equal(line.event, "cache tags revalidate failed");
  assert.equal(line.tagCount, 3);
  assert.equal(line.failedCount, 1);
  assert.deepEqual(line.tags, ["y"]);
  assert.match(line.error, /Invariant/);
});

test("markCacheTags: 範囲の外は投げずに数えて 1 行(console.warn の JSON)、札は頭の 5 件まで", () => {
  assert.doesNotThrow(() => markCacheTags("t1"));
  markCacheTags("a", "b", "c", "d", "e", "f");
  markCacheTags("");
  assert.equal(warns.length, 2, "空だけの呼び出しは数えない");
  const first = JSON.parse(warns[0]!);
  const second = JSON.parse(warns[1]!);
  assert.equal(first.event, "cache tags not revalidated outside a request");
  assert.deepEqual(first.tags, ["t1"]);
  assert.equal(second.count, first.count + 1);
  assert.equal(second.tagCount, 6);
  assert.deepEqual(second.tags, ["a", "b", "c", "d", "e"]);
});

test("readThrough: 包んだ読みが投げたら DB を直に読んで返し記録の 1 行、DomainError はそのまま、成功は包んだ値", async () => {
  let direct = 0;
  const read = () => {
    direct += 1;
    return Promise.resolve("from-db");
  };
  assert.equal(await readThrough("post.get", async () => "from-cache", read), "from-cache");
  assert.equal(direct, 0);
  assert.equal(await readThrough("post.get", async () => { throw new Error("store is down"); }, read), "from-db");
  assert.equal(direct, 1);
  const line = JSON.parse(errors[0]!);
  assert.equal(line.event, "cache read fell back to the database");
  assert.equal(line.read, "post.get");
  assert.match(line.error, /store is down/);
  await assert.rejects(readThrough("post.get", async () => { throw new DomainError("見つかりません", { status: 404 }); }, read), /見つかりません/);
  assert.equal(direct, 1, "DomainError では DB を読み直さない");
});

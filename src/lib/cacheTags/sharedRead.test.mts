// src/lib/cacheTags/sharedRead.ts のテスト(next/cache は差し替える。node では指令 "use cache: remote" は効かず体がそのまま走る)
// - 体が cacheLife・cacheTag に寿命と札を渡し、名前で引いた読みを呼ぶ
// - 置き場が投げたら(ここでは cacheLife が投げる)読みを直に呼んで返し、記録の 1 行
// - 同じ名前の別の読みは投げる、同じ定義の読み直しは通す
// 実行: pnpm test src/lib/cacheTags
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

const seen: { life: unknown[]; tags: string[][] } = { life: [], tags: [] };
let failCache = false;
mock.module("next/cache", {
  namedExports: {
    revalidateTag: () => {},
    cacheLife: (life: unknown) => {
      if (failCache) throw new Error("remote handler down");
      seen.life.push(life);
    },
    cacheTag: (...tags: string[]) => void seen.tags.push(tags),
  },
});

const { defineSharedRead } = await import("./server.ts");

let errors: string[] = [];
beforeEach(() => {
  errors = [];
  seen.life = [];
  seen.tags = [];
  failCache = false;
  mock.method(console, "error", (line: string) => errors.push(line));
});
afterEach(() => mock.restoreAll());

const life = { revalidate: 60, expire: 60 };

test("defineSharedRead: 寿命と札を置き場に渡し、名前で引いた読みに引数を渡す", async () => {
  const calls: unknown[][] = [];
  const read = defineSharedRead("t.sum", async (a: number, b: { x: number }) => {
    calls.push([a, b]);
    return a + b.x;
  });
  assert.equal(await read({ life, tags: ["analytics", "analytics:t.sum"] }, 1, { x: 2 }), 3);
  assert.deepEqual(calls, [[1, { x: 2 }]]);
  assert.deepEqual(seen.life, [life]);
  assert.deepEqual(seen.tags, [["analytics", "analytics:t.sum"]]);
  assert.deepEqual(errors, []);
});

test("defineSharedRead: 札が空なら cacheTag を呼ばない", async () => {
  const read = defineSharedRead("t.noTags", async () => "v");
  assert.equal(await read({ life, tags: [] }), "v");
  assert.deepEqual(seen.tags, []);
});

test("defineSharedRead: 置き場が投げたら読みを直に呼んで返し、記録の 1 行", async () => {
  let direct = 0;
  const read = defineSharedRead("t.fallback", async () => ++direct);
  failCache = true;
  assert.equal(await read({ life, tags: [] }), 1);
  assert.equal(errors.length, 1);
  const line = JSON.parse(errors[0]);
  assert.equal(line.event, "cache read fell back to the database");
  assert.equal(line.read, "t.fallback");
});

test("defineSharedRead: 同じ名前の別の読みは投げ、同じ定義の読み直し(開発中の再読み込み)は通す", () => {
  const make = () => defineSharedRead("t.dup", async () => 1);
  make();
  assert.doesNotThrow(make);
  assert.throws(() => defineSharedRead("t.dup", async () => 2), /別の読みで定義済み/);
  assert.throws(() => defineSharedRead("", async () => 1), /name を書いて/);
});

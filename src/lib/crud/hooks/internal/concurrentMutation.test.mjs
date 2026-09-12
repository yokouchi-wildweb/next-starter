// 並列 trigger の契約テスト（React 非依存部分）。
// 実行: pnpm test:crud-hooks  （node:test + Node 組み込みの TypeScript type stripping。追加依存なし）
import { test } from "node:test";
import assert from "node:assert/strict";
import { createConcurrentMutation } from "./concurrentMutation.ts";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const tick = () => new Promise((r) => setTimeout(r, 0));

test("並列 2 発で先行 trigger が reject → Promise.all は reject する（後続の成功に握りつぶされない）", async () => {
  const first = deferred();
  const second = deferred();
  const calls = [];
  const mutation = createConcurrentMutation({
    execute: (arg) => {
      calls.push(arg);
      return arg === "a" ? first.promise : second.promise;
    },
  });

  const all = Promise.all([mutation.trigger("a"), mutation.trigger("b")]);
  assert.equal(mutation.getSnapshot().isMutating, true);

  const boom = new Error("400 stock shortage");
  first.reject(boom);
  second.resolve({ id: "b" });

  await assert.rejects(all, (e) => e === boom);
  assert.deepEqual(calls, ["a", "b"]);
});

test("成功した trigger は自分の結果で resolve する（先行分も undefined にならない）", async () => {
  const first = deferred();
  const second = deferred();
  const mutation = createConcurrentMutation({
    execute: (arg) => (arg === "a" ? first.promise : second.promise),
  });

  const pa = mutation.trigger("a");
  const pb = mutation.trigger("b");
  // 後続が先に完了しても先行分は捨てられない
  second.resolve({ id: "b" });
  await tick();
  first.resolve({ id: "a" });

  assert.deepEqual(await pa, { id: "a" });
  assert.deepEqual(await pb, { id: "b" });
});

test("isMutating は全件 settle まで true、settle 後 false", async () => {
  const first = deferred();
  const second = deferred();
  const seen = [];
  const mutation = createConcurrentMutation({
    execute: (arg) => (arg === "a" ? first.promise : second.promise),
    onChange: (s) => seen.push(s.isMutating),
  });

  const pa = mutation.trigger("a");
  const pb = mutation.trigger("b").catch(() => {});
  second.reject(new Error("b failed"));
  await tick();
  // 後続が失敗して settle しても先行が飛んでいる間は true
  assert.equal(mutation.getSnapshot().isMutating, true);
  first.resolve("ok");
  await pa;
  await pb;
  assert.equal(mutation.getSnapshot().isMutating, false);
  assert.equal(seen.at(-1), false);
});

test("error / data は直近に settle した trigger の結果", async () => {
  const mutation = createConcurrentMutation({
    execute: async (arg) => {
      if (arg === "fail") throw new Error("nope");
      return arg;
    },
  });

  await mutation.trigger("x");
  assert.equal(mutation.getSnapshot().data, "x");
  assert.equal(mutation.getSnapshot().error, undefined);

  await assert.rejects(mutation.trigger("fail"));
  assert.equal(mutation.getSnapshot().error.message, "nope");

  await mutation.trigger("y");
  assert.equal(mutation.getSnapshot().data, "y");
  assert.equal(mutation.getSnapshot().error, undefined);
});

test("onSuccess は成功した trigger ごとに resolve 前に await される。失敗した trigger では呼ばれない", async () => {
  const order = [];
  const mutation = createConcurrentMutation({
    execute: async (arg) => {
      if (arg === "fail") throw new Error("nope");
      return arg;
    },
    onSuccess: async (data) => {
      await tick();
      order.push(`revalidated:${data}`);
    },
  });

  const results = await Promise.allSettled([
    mutation.trigger("a").then((d) => order.push(`resolved:${d}`)),
    mutation.trigger("fail"),
    mutation.trigger("b").then((d) => order.push(`resolved:${d}`)),
  ]);

  assert.equal(results[1].status, "rejected");
  assert.ok(order.indexOf("revalidated:a") < order.indexOf("resolved:a"));
  assert.ok(order.indexOf("revalidated:b") < order.indexOf("resolved:b"));
  assert.equal(order.filter((o) => o.startsWith("revalidated:")).length, 2);
});

test("onSuccess（再検証）の失敗は書き込み成功を reject に変えない", async () => {
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    const mutation = createConcurrentMutation({
      execute: async () => "written",
      onSuccess: async () => {
        throw new Error("revalidate failed");
      },
    });
    assert.equal(await mutation.trigger("a"), "written");
    assert.equal(mutation.getSnapshot().error, undefined);
    assert.equal(logged.length, 1);
  } finally {
    console.error = originalError;
  }
});

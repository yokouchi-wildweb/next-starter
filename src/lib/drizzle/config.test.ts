// src/lib/drizzle/config.test.ts
// 接続プールの設定の上書きが postgres(...) のオプションに届くこと・不正な値が検査で落ちることのテスト。
// 実行: pnpm test src/lib/drizzle (node:test。ドライバは偽物を渡す)
import { test } from "node:test";
import assert from "node:assert/strict";

import type postgres from "postgres";

import { drizzleConfig, drizzleConfigDef } from "./config";
import { createQueryClient } from "./pool";

/** postgres の偽物。受け取った引数を記録する */
function fakeConnect() {
  const calls: Array<{ url: string; options: unknown }> = [];
  const connect = ((url: string, options: unknown) => {
    calls.push({ url, options });
    return {} as ReturnType<typeof postgres>;
  }) as unknown as typeof postgres;
  return { connect, calls };
}

// 上流の既定は compose({}) で見る(読み込んだ drizzleConfig は fork が src/config/lib/drizzle.config.ts に書いた値で変わる)
test("上流の既定(空の上書き)では今と同じ { prepare: false, max: 3 }", () => {
  const defaults = drizzleConfigDef.compose({});
  assert.deepEqual(defaults, { max: 3 });
  const { connect, calls } = fakeConnect();
  createQueryClient("postgres://x", defaults, connect);
  assert.deepEqual(calls, [{ url: "postgres://x", options: { prepare: false, max: 3 } }]);
});

test("読み込んだ設定(@lib-config/drizzle)は検査を通った形", () => {
  assert.equal(Number.isInteger(drizzleConfig.max) && drizzleConfig.max > 0, true);
});

test("上書きの値が postgres(...) のオプション(max / idle_timeout / connect_timeout)に届く", () => {
  const config = drizzleConfigDef.compose({ max: 50, idleTimeout: 20, connectTimeout: 10 });
  const { connect, calls } = fakeConnect();
  createQueryClient("postgres://x", config, connect);
  assert.deepEqual(calls[0]?.options, { prepare: false, max: 50, idle_timeout: 20, connect_timeout: 10 });
});

test("書かないタイムアウトは渡さない(postgres-js の既定のまま)", () => {
  const { connect, calls } = fakeConnect();
  createQueryClient("postgres://x", drizzleConfigDef.compose({ idleTimeout: 30 }), connect);
  assert.deepEqual(calls[0]?.options, { prepare: false, max: 3, idle_timeout: 30 });
});

for (const [name, override] of [
  ["max: 0", { max: 0 }],
  ["max が負", { max: -1 }],
  ["max が小数", { max: 2.5 }],
  ["idleTimeout: 0", { idleTimeout: 0 }],
  ["connectTimeout が負", { connectTimeout: -5 }],
  ["connectTimeout が小数", { connectTimeout: 1.5 }],
] as const) {
  test(`不正な値は検査で落ちる: ${name}`, () => {
    assert.throws(() => drizzleConfigDef.compose(override), { name: "ConfigValidationError" });
  });
}

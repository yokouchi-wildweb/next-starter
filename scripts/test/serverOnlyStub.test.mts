// scripts/test/serverOnlyStub.test.mts
// serverOnlyStub.mjs の回帰テスト: --experimental-test-module-mocks 付きでも `server-only` が空モジュールに解決されること。
// module mocks を有効にすると CJS の require がテストランナーの mock ローダー経由になり、registerHooks の resolve を通らない。
// node_modules/server-only が無い状態（依存に入れない方針）でここが落ちたら、stub の Module._resolveFilename の包みを確かめる。
// 実行: pnpm test:server-only-stub

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { mock, test } from "node:test";

// 解決の可否は stub 自体が変えてしまうため、実体の有無をファイルで見る
test("node_modules に server-only が無い（あると stub を通らずに通ってしまう）", () => {
  assert.equal(existsSync(resolve(process.cwd(), "node_modules/server-only")), false);
});

test("module mocks 有効時も、server-only を import する CJS モジュールを読み込める", async () => {
  // mock.module を 1 つでも使うと CJS の読み込みが mock ローダー経由になる（壊れていた経路）
  mock.module("node:os", { namedExports: { hostname: () => "stub" } });
  const mod = await import("./fixtures/usesServerOnly.ts");
  assert.equal(mod.loaded, true);
});

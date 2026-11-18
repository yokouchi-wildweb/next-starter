// scripts/structure/proxies/testGate.test.mjs — 門番のテストの段の、落ちたテストの分け方
// 実行: pnpm test scripts/structure/proxies/testGate.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyFailures } from "./testGate.mjs";

const OUTPUT = `✔ 通るテスト (1ms)
ℹ tests 3
ℹ fail 3
✖ failing tests:

test at src/featureGate/a.test.ts:3:1
✖ 住所が閉じない (1.2ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

test at src/featureGate/b.test.ts:4:1
✖ DB に頼るテスト (0.1ms)
  Error [DatabaseNotConfiguredError]: DATABASE_URL が未設定です

test at scripts/structure/proxies/c.test.mjs:1:1
✖ scripts/structure/proxies/c.test.mjs
  Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'x'
`;

test("違反と環境の依存の不足に分ける(場所・名前・印)", () => {
  const { violations, environment } = classifyFailures(OUTPUT);
  assert.deepEqual(violations, [{ at: "src/featureGate/a.test.ts:3:1", name: "住所が閉じない" }]);
  assert.deepEqual(
    environment.map((e) => [e.at, e.reason]),
    [
      ["src/featureGate/b.test.ts:4:1", "DatabaseNotConfiguredError"],
      ["scripts/structure/proxies/c.test.mjs:1:1", "ERR_MODULE_NOT_FOUND"],
    ],
  );
});

test("落ちたテストの一覧が無い出力は空(全部通った)", () => {
  assert.deepEqual(classifyFailures("ℹ tests 3\nℹ pass 3\nℹ fail 0\n"), { violations: [], environment: [] });
});

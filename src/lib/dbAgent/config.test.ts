// src/lib/dbAgent/config.test.ts
// DB 調査エージェントの設定の上書きが効くことのテスト。実行: pnpm test src/lib/dbAgent (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { dbAgentConfigDef } from "./config";

// 上流の既定は compose({}) で見る(読み込んだ dbAgentConfig は fork が src/config/lib/dbAgent.config.ts に書いた値で変わる)
test("上流の空の上書きでは既定のまま", () => {
  assert.deepEqual(dbAgentConfigDef.compose({}), {
    maxRows: 200,
    statementTimeoutMs: 10_000,
    maxResultChars: 30_000,
    maxQueryChars: 10_000,
    maxSystemSuffixChars: 4_000,
  });
});

test("上書きの値が効き、書かないキーは既定のまま", () => {
  const config = dbAgentConfigDef.compose({ maxRows: 500, statementTimeoutMs: 20_000 });
  assert.equal(config.maxRows, 500);
  assert.equal(config.statementTimeoutMs, 20_000);
  assert.equal(config.maxQueryChars, 10_000);
});

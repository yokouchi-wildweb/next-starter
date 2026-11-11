// src/lib/ai/config.test.ts
// AI エージェント基盤の設定の上書きが効くことのテスト。実行: pnpm test src/lib/ai (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { aiConfigDef } from "./config";

// 上流の既定は compose({}) で見る(読み込んだ aiConfig は fork が src/config/lib/ai.config.ts に書いた値で変わる)
test("上流の空の上書きでは既定のまま", () => {
  assert.deepEqual(aiConfigDef.compose({}), { model: "claude-opus-4-8", maxIterations: 12, maxTokensPerStep: 16000 });
});

test("上書きの値が効き、書かないキーは既定のまま", () => {
  const config = aiConfigDef.compose({ model: "claude-sonnet-5", maxIterations: 8 });
  assert.equal(config.model, "claude-sonnet-5");
  assert.equal(config.maxIterations, 8);
  assert.equal(config.maxTokensPerStep, 16000);
});

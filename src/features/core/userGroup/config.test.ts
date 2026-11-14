// src/features/core/userGroup/config.test.ts
// ユーザーグループの設定の既定と上書きのテスト。実行: pnpm test src/features/core/userGroup (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { userGroupConfig, userGroupConfigDef } from "./config";

// 上流の既定は compose({}) で見る(読み込んだ設定は fork が src/config/features/userGroup.config.ts に書いた値で変わる)
test("上流の空の上書きでは既定のまま(人数の上限 10 万、節 50・深さ 6)", () => {
  assert.deepEqual(Object.keys(userGroupConfig).sort(), Object.keys(userGroupConfigDef.compose({})).sort());
  assert.deepEqual(userGroupConfigDef.compose({}), { memberLimit: 100_000, definition: { maxNodes: 50, maxDepth: 6 } });
});

test("上書きの値が効き、上書きの無いキーは既定のまま", () => {
  const config = userGroupConfigDef.compose({ memberLimit: 300_000, definition: { maxDepth: 4 } });
  assert.equal(config.memberLimit, 300_000);
  assert.deepEqual(config.definition, { maxNodes: 50, maxDepth: 4 });
});

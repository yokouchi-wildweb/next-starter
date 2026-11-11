// src/features/core/accountLifecycle/config.test.ts
// 休会・退会・復帰の設定の上書きが効くことのテスト。実行: pnpm test src/features/core/accountLifecycle (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { accountLifecycleConfig, accountLifecycleConfigDef } from "./config";

const DEFAULT_DESCRIPTION =
  "退会すると、アカウントに関連するデータにアクセスできなくなります。 退会後に再度サービスを利用する場合は、新規登録が必要です。";

// 上流の既定は compose({}) で見る(読み込んだ設定は fork が src/config/features/accountLifecycle.config.ts に書いた値で変わる)
test("上流の空の上書きでは既定のまま、読み込んだ設定も同じキー", () => {
  assert.deepEqual(Object.keys(accountLifecycleConfig).sort(), Object.keys(accountLifecycleConfigDef.compose({})).sort());
  assert.deepEqual(accountLifecycleConfigDef.compose({}), { withdraw: { description: DEFAULT_DESCRIPTION } });
});

test("上書きの値が退会の説明文に効く", () => {
  const config = accountLifecycleConfigDef.compose({ withdraw: { description: "退会すると保有ポイントは失効します。" } });
  assert.equal(config.withdraw.description, "退会すると保有ポイントは失効します。");
});

test("上書きの無いキーは既定のまま", () => {
  assert.equal(accountLifecycleConfigDef.compose({ withdraw: {} }).withdraw.description, DEFAULT_DESCRIPTION);
});

// src/lib/realtimeRoom/config.test.ts
// リアルタイムルーム基盤の設定の上書きが効くことのテスト。実行: pnpm test src/lib/realtimeRoom (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { realtimeRoomConfigDef } from "./config";

// 上流の既定は compose({}) で見る(読み込んだ realtimeRoomConfig は fork が src/config/lib/realtimeRoom.config.ts に書いた値で変わる)
test("上流の空の上書きでは既定のまま(無効・トークン 60 秒・再接続 1〜15 秒)", () => {
  assert.deepEqual(realtimeRoomConfigDef.compose({}), {
    enabled: false,
    clientTokenTtlSeconds: 60,
    serviceTokenTtlSeconds: 60,
    reconnectBaseDelayMs: 1_000,
    reconnectMaxDelayMs: 15_000,
  });
});

test("上書きの値が効き、書かないキーは既定のまま", () => {
  const config = realtimeRoomConfigDef.compose({ enabled: true, clientTokenTtlSeconds: 30 });
  assert.equal(config.enabled, true);
  assert.equal(config.clientTokenTtlSeconds, 30);
  assert.equal(config.serviceTokenTtlSeconds, 60);
  assert.equal(config.reconnectMaxDelayMs, 15_000);
});

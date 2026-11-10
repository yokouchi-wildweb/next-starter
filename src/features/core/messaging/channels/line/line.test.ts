// LINE の経路の項目の検査(push は偽物)
// - 既定は切(messaging の config の値 = enabled false)
// - 宛先は LINE の連携の line_user_id、本文はテキスト
// - lib/line の誤りの文から状態を読み、429・5xx → transient / 他の 4xx → permanent / 応答なし → unknown
// 実行: pnpm test src/features/core/messaging/channels/line
import { test } from "node:test";
import assert from "node:assert/strict";

import { messagingConfig } from "../../config";
import { classifyLineError, createLineChannel } from "./createLineChannel";

test("既定は切(config の channels.line.enabled = false)", () => {
  assert.equal(messagingConfig.channels.line.enabled, false);
  const channel = createLineChannel({ enabled: false, findLineUserIds: async () => [], push: async () => ({}) });
  assert.equal(channel.enabled, false);
  assert.equal(channel.key, "line");
});

test("宛先へテキストを push し、誤りを分類する", async () => {
  const pushed: [string, string][] = [];
  const channel = createLineChannel({
    enabled: true,
    findLineUserIds: async (ids) => ids.map((userId) => ({ userId, address: `L-${userId}` })),
    push: async (to, text) => {
      if (to === "L-429") throw new Error("LINE Messaging API エラー: 429 rate");
      if (to === "L-400") throw new Error("LINE Messaging API エラー: 400 bad");
      if (to === "L-net") throw new TypeError("fetch failed");
      pushed.push([to, text]);
      return {};
    },
  });
  assert.deepEqual(await channel.resolveAddresses!(["u1"]), [{ userId: "u1", address: "L-u1" }]);
  const results = await channel.send(
    ["L-u1", "L-429", "L-400", "L-net"].map((address) => ({ userId: "u1", address, idempotencyKey: "d1", content: { text: "こんにちは" } })),
  );
  assert.deepEqual(results.map((r) => r.kind), ["sent", "transient", "permanent", "unknown"]);
  assert.deepEqual(pushed, [["L-u1", "こんにちは"]]);
});

test("状態の読み取り: 5xx は transient", () => {
  assert.deepEqual(classifyLineError(new Error("LINE Messaging API エラー: 503 x")), { kind: "transient", reason: "http_503" });
});

// LINE の経路の項目の検査(push は偽物)
// - 既定は切(messaging の config の値 = enabled false)
// - 宛先は LINE の連携の line_user_id、本文はテキスト
// - lib/line の LineApiError の retryable → transient(429・5xx・応答なし)/ 他 → permanent / LineApiError でない例外 → unknown
// - push に X-Line-Retry-Key の鍵 = lineRetryKey(冪等の鍵)を渡す(宛先ごとに違い、送り直しで同じ)
// 実行: pnpm test src/features/core/messaging/channels/line
import { test } from "node:test";
import assert from "node:assert/strict";

import { LineApiError, lineRetryKey } from "@/lib/line";

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
      if (to === "L-429") throw new LineApiError({ status: 429, body: "rate" });
      if (to === "L-400") throw new LineApiError({ status: 400, body: "bad" });
      if (to === "L-net") throw new LineApiError({ status: null, body: null, cause: new TypeError("fetch failed") });
      if (to === "L-other") throw new Error("boom");
      pushed.push([to, text]);
      return {};
    },
  });
  assert.deepEqual(await channel.resolveAddresses!(["u1"]), [{ userId: "u1", address: "L-u1" }]);
  const results = await channel.send(
    ["L-u1", "L-429", "L-400", "L-net", "L-other"].map((address) => ({ userId: "u1", address, messageKey: "shop.notice", idempotencyKey: "d1", content: { text: "こんにちは" } })),
  );
  assert.deepEqual(results.map((r) => r.kind), ["sent", "transient", "permanent", "transient", "unknown"]);
  assert.deepEqual(results.map((r) => ("reason" in r ? r.reason : null)), [null, "http_429", "http_400", "line_no_response", "send_threw"]);
  assert.deepEqual(pushed, [["L-u1", "こんにちは"]]);
});

test("push に再試行の鍵 = lineRetryKey(冪等の鍵) を渡す(宛先ごとに違い、送り直しで同じ)", async () => {
  const keys: [string, string][] = [];
  const channel = createLineChannel({
    enabled: true,
    findLineUserIds: async () => [],
    push: async (to, _text, options) => {
      keys.push([to, options.retryKey]);
      return {};
    },
  });
  const send = () =>
    channel.send(
      [
        ["L-a", "d1:0"],
        ["L-b", "d1:1"],
      ].map(([address, idempotencyKey]) => ({ userId: "u1", address, messageKey: "shop.notice", idempotencyKey, content: { text: "x" } })),
    );
  await send();
  await send();
  assert.deepEqual(keys.slice(0, 2), [
    ["L-a", lineRetryKey("d1:0")],
    ["L-b", lineRetryKey("d1:1")],
  ]);
  assert.notEqual(keys[0][1], keys[1][1]);
  assert.deepEqual(keys.slice(2), keys.slice(0, 2));
});

test("分類: 5xx は transient、LineApiError でない例外は unknown", () => {
  assert.deepEqual(classifyLineError(new LineApiError({ status: 503, body: "x" })), { kind: "transient", reason: "http_503" });
  assert.deepEqual(classifyLineError(new Error("LINE Messaging API エラー: 503 x")), { kind: "unknown", reason: "send_threw" });
});

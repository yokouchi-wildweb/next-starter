// ワンクリックの配信停止の記録の検査(DB は偽物)
// - user:<id> → 好みの行(種類 × 経路、source one_click)。何度届いても 1 行。利用者がいなければ何もしない
// - addr:<hash> → 宛先の停止(reason one_click、scope = 種類)
// 実行: pnpm test src/features/core/messaging/services/server/unsubscribe
import { test } from "node:test";
import assert from "node:assert/strict";

import { recordOneClickUnsubscribe, type OneClickStore } from "./recordOneClick";

function memory(users: string[]) {
  const preferences = new Set<string>();
  const suppressions = new Set<string>();
  const store: OneClickStore = {
    async addPreference({ userId, category, channel, source }) {
      if (!users.includes(userId)) return false;
      preferences.add(`${userId}|${category}|${channel}|${source}`);
      return true;
    },
    async addSuppression({ channel, addressHash, scope, source }) {
      suppressions.add(`${channel}|${addressHash}|${scope}|${source}`);
    },
  };
  return { store, preferences, suppressions };
}

test("利用者は好みの行を 1 つ(何度届いても同じ)", async () => {
  const { store, preferences, suppressions } = memory(["u-1"]);
  const payload = { recipientKey: "user:u-1", category: "marketing", channel: "email" };
  assert.deepEqual(await recordOneClickUnsubscribe(store, payload), { recorded: "preference" });
  await recordOneClickUnsubscribe(store, payload);
  assert.deepEqual([...preferences], ["u-1|marketing|email|one_click"]);
  assert.equal(suppressions.size, 0);
});

test("利用者がいなければ何もしない", async () => {
  const { store, preferences } = memory([]);
  assert.deepEqual(await recordOneClickUnsubscribe(store, { recipientKey: "user:gone", category: "marketing", channel: "email" }), {
    recorded: "none",
  });
  assert.equal(preferences.size, 0);
});

test("宛先だけの受信者は宛先の停止(scope = 種類)", async () => {
  const { store, suppressions } = memory([]);
  const hash = "b".repeat(64);
  await recordOneClickUnsubscribe(store, { recipientKey: `addr:${hash}`, category: "activity", channel: "email", addressHash: hash });
  assert.deepEqual([...suppressions], [`email|${hash}|activity|one_click`]);
});

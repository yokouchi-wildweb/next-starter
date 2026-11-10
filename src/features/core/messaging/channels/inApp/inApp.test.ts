// お知らせの経路の項目の検査(DB は偽物)
// - 受信者ごとに message_inbox_items の行を書く(回の id は配達の行から引く)
// - 同じ回 × 利用者の行が既にあれば書かない(送り直しで重ねない)
// - 配達の行が見つからない宛先は permanent
// 実行: pnpm test src/features/core/messaging/channels/inApp
import { test } from "node:test";
import assert from "node:assert/strict";

import type { MessageInboxItemInsert } from "../../entities/model";
import { createInAppChannel } from "./createInAppChannel";

function setup(existing: string[] = []) {
  const inserted: MessageInboxItemInsert[] = [];
  const now = new Date("2026-11-11T00:00:00.000Z");
  const channel = createInAppChannel({
    now: () => now,
    findDispatchIds: async (ids) => new Map(ids.filter((id) => id !== "missing").map((id) => [id, "dispatch-1"])),
    findExistingItems: async () => new Set(existing),
    insertItems: async (rows) => {
      inserted.push(...rows);
    },
  });
  return { channel, inserted, now };
}

const content = { title: "題", body: "本文", link: "/x", image: "storage://img" };

test("受信者ごとにお知らせの行を書き、sent を返す", async () => {
  const { channel, inserted, now } = setup();
  const results = await channel.send([
    { userId: "u1", address: "u1", idempotencyKey: "d1", content },
    { userId: "u2", address: "u2", idempotencyKey: "d2", content },
  ]);
  assert.deepEqual(results.map((r) => r.kind), ["sent", "sent"]);
  assert.deepEqual(inserted, [
    { dispatch_id: "dispatch-1", user_id: "u1", title: "題", body: "本文", link: "/x", image: "storage://img", published_at: now },
    { dispatch_id: "dispatch-1", user_id: "u2", title: "題", body: "本文", link: "/x", image: "storage://img", published_at: now },
  ]);
  assert.deepEqual(await channel.resolveAddresses!(["u1"]), [{ userId: "u1", address: "u1" }]);
});

test("同じ回 × 利用者の行が既にあれば書かずに sent", async () => {
  const { channel, inserted } = setup(["dispatch-1|u1"]);
  const results = await channel.send([{ userId: "u1", address: "u1", idempotencyKey: "d1", content }]);
  assert.equal(results[0].kind, "sent");
  assert.equal(inserted.length, 0);
});

test("配達の行が見つからない宛先は permanent", async () => {
  const { channel } = setup();
  const [result] = await channel.send([{ userId: "u1", address: "u1", idempotencyKey: "missing", content }]);
  assert.equal(result.kind, "permanent");
});

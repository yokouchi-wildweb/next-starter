// 内部の事件(D47 の outbox)の検査(メモリの store。本物は store の書く口が同じ取引で message_events へ書く)
// - 小さな送信(要求の中): 止めた行 → delivery.suppressed、送れた → delivery.sent、要求の中で閉じた回 → dispatch.completed
// - cron: 展開・送信・閉じる で delivery.sent / delivery.failed / dispatch.completed
// - 書くのは購読が聞いている種類だけ(購読なし = 何も書かない)。provider internal、事件ごとに別の provider_event_id
// - 保持の掃除: 購読の一番遅い印より新しい事件は日数を過ぎても消さない(購読なしは今までどおり)
// 実行: pnpm test src/features/core/messaging/services/server/events
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { createDefineMessage, type MessageRegistry } from "@/lib/messaging";

import { createMessageSender } from "../sendMessage/sender";
import { createTestChannel, testConfig } from "../sendMessage/testHelpers";
import { pruneMessaging } from "../sweep/retention";
import { sweepMessages } from "../sweep/sweep";
import { createMemoryWorld, createSweepDeps } from "../sweep/testHelpers";
import { INTERNAL_EVENT_PROVIDER, INTERNAL_EVENT_TYPES, subscribedEventTypes } from "./internalEvents";

const fields = { test: z.object({ title: z.string(), body: z.string().optional() }).strict() };
const defineTestMessage = createDefineMessage<typeof fields>();
const notice = defineTestMessage({
  key: "shop.notice",
  category: "news",
  vars: z.object({ item: z.string() }),
  content: { test: { title: "{{item}}" } },
});
const registry: MessageRegistry = { "shop.notice": { key: "shop.notice", definition: async () => ({ message: notice }) } };
const deadline = () => ({ deadline: new Date(Date.now() + 60_000) });

function setup(types: readonly string[], behave?: Parameters<typeof createTestChannel>[1]) {
  const world = createMemoryWorld();
  for (const id of ["u1", "u2", "u3"]) world.store.users.push({ id, name: id, email: `${id}@x.test` });
  // u3 は宛先なし(止めた行)
  for (const id of ["u1", "u2"]) world.store.endpoints.push({ userId: id, channel: "test", address: `addr-${id}` });
  const deps = createSweepDeps(world, {
    channels: { test: createTestChannel("test", behave) },
    registry,
    eventTypes: subscribedEventTypes([{ key: "fixture", on: types, handle: async () => {} }]),
  });
  return { world, deps, sender: createMessageSender(deps) };
}

const summary = (events: { type?: string; channel?: string | null; delivery_id?: string | null }[]) =>
  events.map((event) => event.type).sort();

test("小さな送信: 止めた行・送れた行・要求の中で閉じた回の事件を書く(provider internal、id は別々)", async () => {
  const { world, sender } = setup([...INTERNAL_EVENT_TYPES]);
  await sender.sendMessageToMany(notice, { recipients: [{ userId: "u1" }, { userId: "u3" }], vars: { item: "靴" } });
  const events = world.store.events;
  assert.deepEqual(summary(events), ["delivery.sent", "delivery.suppressed", "dispatch.completed"]);
  const dispatchId = world.store.dispatches[0].id;
  assert.ok(events.every((event) => event.provider === INTERNAL_EVENT_PROVIDER && event.dispatch_id === dispatchId));
  assert.ok(events.every((event) => event.message_key === "shop.notice"));
  assert.equal(new Set(events.map((event) => event.provider_event_id)).size, 3);
  const suppressed = events.find((event) => event.type === "delivery.suppressed")!;
  assert.equal(suppressed.channel, "test");
  assert.deepEqual(suppressed.payload, { reason: "no_address" });
  assert.equal(events.find((event) => event.type === "dispatch.completed")?.channel, null);
});

test("cron: 送れた・失敗・閉じる の事件を書く", async () => {
  const { world, deps, sender } = setup([...INTERNAL_EVENT_TYPES], (target) =>
    target.address === "addr-u2"
      ? { address: target.address, kind: "permanent", reason: "bad" }
      : { address: target.address, kind: "sent", provider: "fake", providerMessageId: "p" },
  );
  await sender.sendMessageToMany(notice, { audience: { type: "all" }, vars: { item: "x" } });
  assert.equal(world.store.events.length, 0);
  await sweepMessages(deps, deadline());
  assert.deepEqual(summary(world.store.events), ["delivery.failed", "delivery.sent", "dispatch.completed"]);
  assert.deepEqual(world.store.events.find((event) => event.type === "dispatch.completed")?.payload, {
    status: "completed_with_failures",
    isTest: false,
  });
});

test("購読が聞いている種類だけ書く・購読なしは書かない", async () => {
  const failedOnly = setup(["delivery.failed"], (target) => ({ address: target.address, kind: "permanent", reason: "bad" }));
  await failedOnly.sender.sendMessageToMany(notice, { recipients: [{ userId: "u1" }, { userId: "u3" }], vars: { item: "x" } });
  assert.deepEqual(summary(failedOnly.world.store.events), ["delivery.failed"]);

  const none = setup([]);
  await none.sender.sendMessageToMany(notice, { recipients: [{ userId: "u1" }, { userId: "u3" }], vars: { item: "x" } });
  await none.sender.sendMessageToMany(notice, { audience: { type: "all" }, vars: { item: "x" } });
  await sweepMessages(none.deps, deadline());
  assert.equal(none.world.store.events.length, 0);
});

test("保持の掃除: 購読の一番遅い印より新しい事件は日数を過ぎても消さない", async () => {
  const world = createMemoryWorld();
  const old = new Date("2026-01-01T00:00:00Z");
  world.events.push({ id: "e1", createdAt: old, seq: 1 }, { id: "e2", createdAt: old, seq: 2 }, { id: "e3", createdAt: old, seq: 3 });
  const params = { config: testConfig, now: new Date("2026-11-12T00:00:00Z"), deadline: new Date(Date.now() + 60_000) };
  const kept = await pruneMessaging(world.retentionStore, { ...params, slowestSubscriberMark: 1 });
  assert.equal(kept.events, 1);
  assert.deepEqual(world.events.map((event) => event.id), ["e2", "e3"]);
  const all = await pruneMessaging(world.retentionStore, { ...params, slowestSubscriberMark: null });
  assert.equal(all.events, 2);
});

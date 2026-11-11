// 送信の掃き出し・続きを送る・保持の掃除の検査(メモリの store。SQL の取り方・消し方は store.ts、同じ規則をメモリで写す)
// - d2: lease で取って送る、transient は間を広げて送り直し尽きたら failed、permanent は failed、
//   unknown・lease の切れた sending は送り直さない、複数の宛先は一時の失敗の宛先だけ送り直す
// - d3: 予約と大きな送信・audience を再開の位置から展開し、終えたら status・channel_counts・recipient_count・vars を確定
// - d4: 続きを送るは 1 束だけ
// - d5: 保持の日数で消し、お知らせが参照する回は残し、回の冪等の鍵を移す
// 実行: pnpm test src/features/core/messaging/services/server/sweep
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { createDefineMessage, type ChannelSendResult, type MessageRegistry } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { MESSAGE_EXPAND_DONE } from "../../../entities/schema";
import { createMessageSender } from "../sendMessage/sender";
import { createTestChannel, testConfig } from "../sendMessage/testHelpers";
import { pruneMessaging } from "./retention";
import { continueDispatch, sweepMessages } from "./sweep";
import { createMemoryWorld, createSweepDeps } from "./testHelpers";

const fields = { test: z.object({ title: z.string(), body: z.string().optional() }).strict() };
const defineTestMessage = createDefineMessage<typeof fields>();
const notice = defineTestMessage({
  key: "shop.notice",
  kind: "marketing",
  category: "news",
  vars: z.object({ item: z.string() }),
  defaultChannels: ["test"],
  content: { test: { title: "{{item}}", body: "{{recipientName}} {{item}}" } },
});
const registry: MessageRegistry = {
  "shop.notice": { key: "shop.notice", definition: async () => ({ message: notice }) },
};
const T0 = new Date("2026-11-10T00:00:00.000Z");
const later = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const farFuture = () => new Date(Date.now() + 60_000);

function setup(options: { users?: number; behave?: Parameters<typeof createTestChannel>[1] } = {}) {
  const world = createMemoryWorld();
  for (let i = 1; i <= (options.users ?? 3); i += 1) {
    const id = `u${i}`;
    world.store.users.push({ id, name: `利用者${i}`, email: `${id}@example.test`, role: i === 1 ? "admin" : "user" });
    world.store.endpoints.push({ userId: id, channel: "test", address: `addr-${id}` });
  }
  const channel = createTestChannel("test", options.behave);
  const deps = createSweepDeps(world, { channels: { test: channel }, registry });
  return { world, channel, deps, sender: createMessageSender(deps) };
}

const sweep = (deps: ReturnType<typeof setup>["deps"]) => sweepMessages(deps, { deadline: farFuture() });

test("d2: 小さな送信の残りを lease で取って送り、回を閉じる", async () => {
  const { world, deps, sender, channel } = setup({ users: 5 });
  const recipients = ["u1", "u2", "u3", "u4", "u5"].map((userId) => ({ userId }));
  await sender.sendMessageToMany({ ...notice, record: "meta" }, { recipients, vars: { item: "靴" } });
  assert.equal(world.store.deliveries.filter((row) => row.status === "queued").length, 3);

  const result = await sweep(deps);
  assert.equal(result.claimed, 3);
  assert.equal(result.sent, 3);
  assert.ok(world.store.deliveries.every((row) => row.status === "sent" && row.lock_token === null && row.locked_until === null));
  assert.equal(channel.calls.length, 1 + 2); // 要求の中の 1 束 + 掃き出しの 2 束(deliveryChunkSize 2)
  assert.ok(channel.calls.flat().every((target) => target.messageKey === notice.key));
  const dispatch = world.store.dispatches[0];
  assert.equal(dispatch.status, "completed");
  assert.equal(dispatch.channel_counts?.test.sent, 5);
  assert.equal(dispatch.vars, null); // record meta は閉じる時に消す
  assert.ok(dispatch.completed_at);
});

test("d2: transient は間を広げて送り直し、回数が尽きたら failed。permanent は failed", async () => {
  const { world, deps, sender } = setup({
    behave: (target) =>
      target.address === "addr-u1"
        ? { address: target.address, kind: "permanent", reason: "invalid_address" }
        : { address: target.address, kind: "transient", reason: "rate_limited" },
  });
  await sender.sendMessageToMany(notice, { recipients: [{ userId: "u1" }, { userId: "u2" }], vars: { item: "x" } });
  const u2 = () => world.store.deliveries.find((row) => row.user_id === "u2")!;
  assert.equal(world.store.deliveries.find((row) => row.user_id === "u1")!.status, "failed");
  assert.equal(u2().status, "queued");
  assert.equal(u2().next_attempt_at?.getTime(), later(60).getTime());

  // 時刻が来るまでは取らない
  assert.equal((await sweep(deps)).claimed, 0);

  const expectedDelays = [240, 960, 3840];
  let at = later(60);
  for (const delay of expectedDelays) {
    deps.setNow(at);
    await sweep(deps);
    assert.equal(u2().status, "queued");
    assert.equal(u2().next_attempt_at?.getTime(), at.getTime() + delay * 1000);
    at = u2().next_attempt_at!;
  }
  deps.setNow(at);
  await sweep(deps);
  assert.equal(u2().status, "failed");
  assert.equal(u2().attempts, testConfig.transientRetry.maxAttempts);
  assert.equal(u2().next_attempt_at, null);
  assert.equal(world.store.dispatches[0].status, "completed_with_failures");
  assert.equal(world.store.dispatches[0].channel_counts?.test.failed, 2);
});

test("d2: unknown と lease の切れた sending は自動で送り直さない", async () => {
  const { world, deps, sender, channel } = setup({
    behave: (target) => ({ address: target.address, kind: "unknown", reason: "timeout" }),
  });
  await sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" } });
  assert.equal(world.store.deliveries[0].status, "unknown");
  deps.setNow(later(3600));
  await sweep(deps);
  assert.equal(channel.calls.length, 1);

  // 別の行が sending のまま lease が切れた(処理が落ちた)
  const ok = setup({ users: 5 });
  await ok.sender.sendMessageToMany(notice, {
    recipients: ["u1", "u2", "u3"].map((userId) => ({ userId })),
    vars: { item: "x" },
  });
  const stuck = ok.world.store.deliveries.find((row) => row.status === "queued")!;
  Object.assign(stuck, { status: "sending", locked_until: later(10), lock_token: "dead" });
  ok.deps.setNow(later(60));
  const result = await sweep(ok.deps);
  assert.equal(result.staleToUnknown, 1);
  assert.equal(stuck.status, "unknown");
  assert.equal(stuck.last_error, "stale_sending");
  assert.equal(result.claimed, 0);
  assert.equal(ok.world.store.dispatches[0].status, "completed_with_failures");
});

test("d2: lease を失った処理の書き込みは捨てる(lock_token が合わない)", async () => {
  const { world, deps } = setup();
  await world.sweepStore.updateClaimed("nope", "token-x", { status: "sent" });
  const sender = createMessageSender(deps);
  await sender.sendMessageToMany(notice, { recipients: ["u1", "u2", "u3"].map((userId) => ({ userId })), vars: { item: "x" } });
  const row = world.store.deliveries.find((item) => item.status === "queued")!;
  const [claimed] = await world.sweepStore.claimDue({ now: T0, limit: 1, leaseUntil: later(300), lockToken: "a" });
  assert.equal(claimed.id, row.id);
  // 同じ時刻の 2 つ目の処理は取れない
  assert.equal((await world.sweepStore.claimDue({ now: T0, limit: 5, leaseUntil: later(300), lockToken: "b" })).length, 0);
  await world.sweepStore.updateClaimed(row.id, "b", { status: "failed" });
  assert.equal(row.status, "sending");
});

test("d2: 複数の宛先は一時の失敗の宛先だけ送り直し、行は sent のまま", async () => {
  let call = 0;
  const { world, deps, sender, channel } = setup({
    behave: (target): ChannelSendResult => {
      call += 1;
      if (target.address === "addr-u2") return { address: target.address, kind: "sent", providerMessageId: "pm-1" };
      return call > 2
        ? { address: target.address, kind: "sent", providerMessageId: "pm-2" }
        : { address: target.address, kind: "transient", reason: "rate_limited" };
    },
  });
  world.store.endpoints.push({ userId: "u2", channel: "test", address: "addr-u2-b" });
  await sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" } });
  const row = world.store.deliveries[0];
  assert.equal(row.status, "sent");
  assert.equal(row.next_attempt_at?.getTime(), later(60).getTime());
  deps.setNow(later(60));
  await sweep(deps);
  assert.deepEqual(channel.calls[1].map((target) => target.address), ["addr-u2-b"]);
  assert.equal(row.status, "sent");
  assert.equal(row.next_attempt_at, null);
  assert.ok((row.targets ?? []).every((target) => target.status === "sent"));
  assert.equal(world.store.dispatches[0].status, "completed");
});

test("d2: 定義が一覧に無い回の行は failed(definition_missing)", async () => {
  const { world, deps, sender } = setup({ users: 3 });
  await sender.sendMessageToMany(notice, { recipients: ["u1", "u2", "u3"].map((userId) => ({ userId })), vars: { item: "x" } });
  const swept = await sweepMessages({ ...deps, registry: {} }, { deadline: farFuture() });
  assert.equal(swept.failed, 1);
  assert.equal(world.store.deliveries.find((row) => row.last_error === "definition_missing")?.status, "failed");
});

test("d3: audience を再開の位置から束ごとに展開し、終えたら数と状態を確定する", async () => {
  const { world, deps, sender } = setup({ users: 5 });
  world.store.endpoints = world.store.endpoints.filter((row) => row.userId !== "u5");
  await sender.sendMessageToMany(notice, { audience: { type: "all" }, vars: { item: "x" } });
  const dispatch = world.store.dispatches[0];
  assert.equal(dispatch.expand_cursor, null);
  assert.equal(dispatch.recipient_count, 0);

  // 1 回の実行で展開の束を 2 つまで(再開の位置が進む)
  const swept = await sweepMessages({ ...deps, config: { ...deps.config, sweep: { ...deps.config.sweep, expandChunksPerRun: 2 } } }, { deadline: farFuture() });
  assert.equal(swept.expandedChunks, 2);
  assert.equal(dispatch.expand_cursor, "u4");
  assert.equal(dispatch.recipient_count, 4);
  assert.equal(dispatch.status, "processing");

  await sweep(deps);
  assert.equal(dispatch.expand_cursor, MESSAGE_EXPAND_DONE);
  assert.equal(dispatch.recipient_count, 5);
  assert.equal(world.store.deliveries.length, 4); // u5 は宛先が無いので行なし
  assert.equal(dispatch.status, "completed");
  assert.deepEqual(dispatch.channel_counts?.test, {
    targeted: 5,
    sent: 4,
    failed: 0,
    skipped_no_address: 1,
    skipped_throttled: 0,
    suppressed: 0,
  });
  assert.deepEqual(dispatch.vars, { item: "x" }); // record vars は残す
});

test("d3: 大きな選んだ宛先は一覧の番号から展開し、受信者ごとの値を行に写す", async () => {
  const { world, deps, sender, channel } = setup({ users: 7 });
  world.store.endpoints = world.store.endpoints.filter((row) => row.userId !== "u7");
  const recipients = ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "ghost"].map((userId) => ({ userId }));
  await sender.sendMessageToMany(notice, { recipients, vars: { item: "x" }, recipientVars: { "user:u3": { memo: "M3" } } });
  const dispatch = world.store.dispatches[0];
  assert.equal(dispatch.recipient_count, 8);
  for (let i = 0; i < 5; i += 1) await sweep(deps);
  assert.equal(dispatch.expand_cursor, MESSAGE_EXPAND_DONE);
  assert.equal(dispatch.recipient_count, 7); // ghost は見つからない
  const u7 = world.store.deliveries.find((row) => row.user_id === "u7")!;
  assert.equal(u7.status, "suppressed");
  assert.equal(u7.reason, "no_address");
  const sentToU3 = channel.calls.flat().find((target) => target.userId === "u3")!;
  assert.equal(sentToU3.content.body, "利用者3 x");
  assert.deepEqual(world.store.deliveries.find((row) => row.user_id === "u3")!.vars, { memo: "M3" });
  assert.equal(dispatch.status, "completed");
  assert.equal(dispatch.channel_counts?.test.skipped_no_address, 1);
});

test("d3: 予約の時刻が来た回を動かす", async () => {
  const { world, deps, sender } = setup();
  await sender.sendMessageToMany(notice, { audience: { type: "role", roles: ["admin"] }, vars: { item: "x" } });
  const dispatch = world.store.dispatches[0];
  Object.assign(dispatch, { status: "scheduled", scheduled_at: later(600) });
  await sweep(deps);
  assert.equal(dispatch.status, "scheduled");
  deps.setNow(later(600));
  const result = await sweep(deps);
  assert.equal(result.activated, 1);
  assert.equal(dispatch.status, "completed");
  assert.equal(dispatch.recipient_count, 1);
});

test("d4: 続きを送るは 1 つの回を 1 束だけ進める", async () => {
  const { world, deps, sender } = setup({ users: 5 });
  await sender.sendMessageToMany(notice, { audience: { type: "all" }, vars: { item: "x" } });
  await sender.sendMessageToMany(notice, { audience: { type: "all" }, vars: { item: "y" } });
  const [first, second] = world.store.dispatches;
  const result = await continueDispatch(deps, first.id);
  assert.equal(result.expanded, true);
  assert.equal(result.claimed, 2);
  assert.equal(result.completed, false);
  assert.equal(first.expand_cursor, "u2");
  assert.equal(world.store.deliveries.filter((row) => row.dispatch_id === first.id).length, 2);
  assert.equal(world.store.deliveries.filter((row) => row.dispatch_id === second.id).length, 0);
  assert.equal(second.expand_cursor, null);

  await assert.rejects(continueDispatch(deps, "missing"), (error: unknown) => error instanceof DomainError && error.status === 404);
  Object.assign(second, { status: "completed" });
  await assert.rejects(continueDispatch(deps, second.id), (error: unknown) => error instanceof DomainError && error.status === 409);
});

test("d5: 保持の日数で消し、お知らせが参照する回と送っている途中の回は残し、冪等の鍵を移す", async () => {
  const { world, deps, sender } = setup();
  const day = 24 * 60 * 60 * 1000;
  const now = new Date("2030-01-01T00:00:00.000Z");
  const ago = (days: number) => new Date(now.getTime() - days * day);
  await sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "a" }, idempotencyKey: "old-key-1" });
  await sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "b" }, idempotencyKey: "kept-by-inbox" });
  await sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "c" } });
  await sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "d" }, idempotencyKey: "recent-key" });
  const [old, inbox, oldInFlight, recent] = world.store.dispatches;
  for (const d of [old, inbox, oldInFlight]) Object.assign(d, { createdAt: ago(731) });
  Object.assign(oldInFlight, { status: "processing" });
  Object.assign(recent, { createdAt: ago(100) });
  world.inboxDispatchIds.add(inbox.id);
  for (const row of world.store.deliveries) row.createdAt = ago(100);
  world.store.deliveries.find((row) => row.dispatch_id === recent.id)!.createdAt = ago(10);
  world.events.push({ id: "e-old", createdAt: ago(31) }, { id: "e-new", createdAt: ago(29) });

  const result = await pruneMessaging(world.retentionStore, {
    config: { ...deps.config, retention: { ...deps.config.retention, chunkSize: 1 } },
    now,
    deadline: farFuture(),
  });
  assert.equal(result.events, 1);
  assert.deepEqual(world.events.map((e) => e.id), ["e-new"]);
  assert.equal(result.deliveries, 3);
  assert.equal(result.dispatches, 1);
  assert.equal(result.movedKeys, 1);
  assert.deepEqual(world.store.dispatches.map((d) => d.id), [inbox.id, oldInFlight.id, recent.id]);
  assert.deepEqual([...world.store.movedKeys], ["old-key-1"]);
  // 移した鍵は送る口の重複の確かめに効く
  await assert.rejects(
    sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "a" }, idempotencyKey: "old-key-1" }),
    (error: unknown) => error instanceof DomainError && error.status === 409,
  );
  assert.equal(result.idempotencyKeys, 0); // idempotencyKeyDays null = 無期限

  const expiring = await pruneMessaging(world.retentionStore, {
    config: { ...deps.config, retention: { ...deps.config.retention, idempotencyKeyDays: 0 } },
    now: new Date(now.getTime() + day),
    deadline: farFuture(),
  });
  assert.equal(expiring.idempotencyKeys, 1);
});

const inAppFields = {
  test: fields.test,
  inApp: z.object({ title: z.string(), body: z.string(), link: z.string().optional(), image: z.string().optional() }).strict(),
};
const defineWithInApp = createDefineMessage<typeof inAppFields>();

function setupInApp(inAppBody: string) {
  const news = defineWithInApp({
    key: "shop.news",
    kind: "marketing",
    category: "news",
    vars: z.object({ item: z.string() }),
    defaultChannels: ["test", "inApp"],
    content: {
      test: { title: "{{item}}", body: "{{recipientName}} {{item}}" },
      inApp: { title: "{{serviceName}} {{item}}", body: inAppBody, link: "/news" },
    },
  });
  const world = createMemoryWorld();
  for (let i = 1; i <= 3; i += 1) {
    world.store.users.push({ id: `u${i}`, name: `利用者${i}`, email: null, role: i === 1 ? "admin" : "user" });
    world.store.endpoints.push({ userId: `u${i}`, channel: "test", address: `addr-u${i}` });
  }
  const test = createTestChannel("test");
  const inApp = createTestChannel("inApp");
  inApp.fields = inAppFields.inApp;
  inApp.resolveAddresses = async (ids) => ids.map((userId) => ({ userId, address: userId }));
  const deps = createSweepDeps(world, {
    channels: { test, inApp },
    registry: { "shop.news": { key: "shop.news", definition: async () => ({ message: news }) } },
  });
  return { world, deps, inApp, news, sender: createMessageSender(deps) };
}

test("d3(D32): 全員・ロール宛てのお知らせは回に 1 行の共有の行で、受信者ごとの inApp の行を作らない", async () => {
  const { world, deps, inApp, news, sender } = setupInApp("{{item}} が入荷しました");
  await sender.sendMessageToMany(news, { audience: { type: "role", roles: ["user"] }, vars: { item: "靴" } });
  await sweep(deps);
  const dispatch = world.store.dispatches[0];
  assert.equal(world.inboxItems.length, 1);
  assert.deepEqual(
    { ...world.inboxItems[0], published_at: undefined },
    {
      dispatch_id: dispatch.id,
      user_id: null,
      target_roles: ["user"],
      title: "テストサービス 靴",
      body: "靴 が入荷しました",
      link: "/news",
      image: null,
      published_at: undefined,
    },
  );
  assert.ok(world.store.deliveries.every((row) => row.channel === "test"));
  assert.equal(inApp.calls.length, 0);
  assert.equal(dispatch.status, "completed");
  assert.deepEqual(dispatch.channel_counts?.inApp, {
    targeted: 2,
    sent: 2,
    failed: 0,
    skipped_no_address: 0,
    skipped_throttled: 0,
    suppressed: 0,
  });
  assert.equal(dispatch.channel_counts?.test.sent, 2);
});

test("d3(D32): お知らせの中身が受信者に依れば、全員宛てでも受信者ごとの行", async () => {
  const { world, deps, inApp, news, sender } = setupInApp("{{recipientName}} 様");
  await sender.sendMessageToMany(news, { audience: { type: "all" }, vars: { item: "靴" } });
  await sweep(deps);
  assert.equal(world.inboxItems.length, 0);
  assert.equal(world.store.deliveries.filter((row) => row.channel === "inApp").length, 3);
  assert.equal(inApp.calls.flat().length, 3);
});

test("配信停止(D35・D46): 全員宛ての展開で止めた利用者は行を作らず suppressed に数え、recipient_count から引く", async () => {
  const { world, deps, sender } = setup({ users: 3 });
  world.store.preferences.push({ userId: "u2", category: "*", channel: "*" });
  await sender.sendMessageToMany(notice, { audience: { type: "all" }, vars: { item: "x" } });
  for (let i = 0; i < 3; i += 1) await sweep(deps);
  const dispatch = world.store.dispatches[0];
  assert.deepEqual(world.store.deliveries.map((row) => row.user_id).sort(), ["u1", "u3"]);
  assert.equal(dispatch.recipient_count, 2);
  assert.equal(dispatch.channel_counts?.test.suppressed, 1);
  assert.equal(dispatch.channel_counts?.test.sent, 2);
  assert.equal(dispatch.status, "completed");
});

test("配信停止(D35): キューに置いた後で止めた人は、送る直前に外す(reason preference)", async () => {
  const { world, deps, sender, channel } = setup({ users: 5 });
  await sender.sendMessageToMany(notice, {
    recipients: ["u1", "u2", "u3", "u4", "u5"].map((userId) => ({ userId })),
    vars: { item: "x" },
  });
  // 最初の束(u1・u2)の後、u5 が止めた
  world.store.preferences.push({ userId: "u5", category: "news", channel: "test" });
  await sweep(deps);
  const u5 = world.store.deliveries.find((row) => row.user_id === "u5")!;
  assert.deepEqual([u5.status, u5.reason, u5.next_attempt_at, u5.lock_token], ["suppressed", "preference", null, null]);
  assert.ok(!channel.calls.flat().some((target) => target.userId === "u5"));
  assert.equal(world.store.dispatches[0].status, "completed");
});

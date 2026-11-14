// 会話の間引き(D48)の検査。DB はメモリの store(鍵ごとの mutex)、経路はテスト用の inApp とメール役の mail。
// - untilRead: 最初の 1 通はふつう(鍵つきのお知らせ・回数 1)、未読の間は置き換え(回数 + 1・前の回を残す・上に出す)+ 他の経路は throttled
// - 既読の後・別の by の値はふつう。window(と inApp の無い untilRead)は前の送りから seconds 以内だけ間引く
// - {{collapsedCount}} が埋まる。全員・ロール宛ての回は間引かない。同時の 2 つの送りでもお知らせ 1 つ・メール 1 通。cron の送りも同じ
// 実行: pnpm test src/features/core/messaging/services/server/sendMessage
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { createDefineMessage, type MessageRegistry } from "@/lib/messaging";

import { createMemoryWorld, createSweepDeps } from "../sweep/testHelpers";
import { sweepMessages } from "../sweep/sweep";
import { createMessageSender } from "./sender";
import { createMemoryThrottleStore, createTestChannel } from "./testHelpers";
import { throttleKeyOf } from "./throttle";

const field = z.object({ title: z.string(), body: z.string().optional() }).strict();
const fields = { inApp: field, mail: field };
const define = createDefineMessage<typeof fields>();

const chat = define({
  key: "chat.newMessage",
  label: "テストの連絡",
  category: "chat",
  vars: z.object({ roomId: z.string(), text: z.string() }),
  throttle: { by: ["roomId"], mode: "untilRead", seconds: 600 },
  content: {
    inApp: { title: "新着 {{collapsedCount}} 件", body: "{{text}}" },
    mail: { title: "新着", body: "{{text}} ({{collapsedCount}})" },
  },
});
const mailOnly = { ...chat, key: "chat.mailOnly" as const, category: "chatMail" };
const windowed = { ...chat, key: "chat.windowed" as const, throttle: { by: ["roomId"] as const, mode: "window" as const, seconds: 60 } };

const registry: MessageRegistry = Object.fromEntries(
  [chat, mailOnly, windowed].map((definition) => [definition.key, { key: definition.key, definition: async () => ({ message: definition }) }]),
);
const T0 = new Date("2026-11-10T00:00:00.000Z");
const later = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

function setup(users = 3) {
  const world = createMemoryWorld();
  for (let i = 1; i <= users; i += 1) {
    const id = `u${i}`;
    world.store.users.push({ id, name: `利用者${i}`, email: `${id}@example.test`, role: "user" });
    world.store.endpoints.push({ userId: id, channel: "inApp", address: id });
    world.store.endpoints.push({ userId: id, channel: "mail", address: `${id}@example.test` });
  }
  const inApp = createTestChannel("inApp");
  const mail = createTestChannel("mail");
  const throttle = createMemoryThrottleStore(world.store);
  const deps = createSweepDeps(world, { channels: { inApp, mail }, registry, throttle });
  deps.setNow(T0);
  return { world, deps, inApp, mail, throttle, sender: createMessageSender(deps) };
}

const send = (ctx: ReturnType<typeof setup>, text: string, roomId = "r1", definition = chat, userId = "u2") =>
  ctx.sender.sendMessage(definition, { recipient: { userId }, vars: { roomId, text } });
const mailSent = (ctx: ReturnType<typeof setup>) => ctx.mail.calls.flat().length;

test("untilRead: 最初の 1 通はふつうに送り、鍵つきのお知らせ(回数 1)を書く", async () => {
  const ctx = setup();
  const result = await send(ctx, "こんにちは");
  assert.equal(ctx.throttle.items.length, 1);
  const item = ctx.throttle.items[0];
  assert.equal(item.throttle_key, throttleKeyOf("user:u2", chat.key, ["roomId"], { roomId: "r1" }));
  assert.equal(item.collapsed_count, 1);
  assert.equal(item.title, "新着 1 件");
  assert.equal(item.dispatch_id, result.dispatchId);
  // お知らせは間引きが書く(inApp の経路の send は通らない)。メールの {{collapsedCount}} は 1
  assert.equal(ctx.inApp.calls.length, 0);
  assert.equal(mailSent(ctx), 1);
  assert.equal(ctx.mail.calls[0][0].content.body, "こんにちは (1)");
  const inAppRow = ctx.world.store.deliveries.find((row) => row.channel === "inApp")!;
  assert.equal(inAppRow.status, "sent");
  assert.equal(inAppRow.reason, null);
  assert.equal(result.channelCounts.inApp.sent, 1);
  assert.equal(result.channelCounts.mail.sent, 1);
});

test("untilRead: 未読の間は置き換え(中身・回数・前の回・上に出す)、他の経路は throttled", async () => {
  const ctx = setup();
  const first = await send(ctx, "1 通目");
  ctx.deps.setNow(later(30));
  const second = await send(ctx, "2 通目");
  ctx.deps.setNow(later(60));
  const third = await send(ctx, "3 通目");

  assert.equal(ctx.throttle.items.length, 1);
  const item = ctx.throttle.items[0];
  assert.equal(item.body, "3 通目");
  assert.equal(item.title, "新着 3 件");
  assert.equal(item.collapsed_count, 3);
  assert.equal(item.dispatch_id, third.dispatchId);
  assert.deepEqual(item.collapsed_dispatch_ids, [first.dispatchId, second.dispatchId]);
  assert.equal(item.published_at.getTime(), later(60).getTime());
  assert.equal(item.read, false);
  assert.equal(mailSent(ctx), 1);

  const rows = ctx.world.store.deliveries.filter((row) => row.dispatch_id === third.dispatchId);
  assert.deepEqual(
    rows.map((row) => [row.channel, row.status, row.reason]).sort(),
    [
      ["inApp", "sent", "throttled"],
      ["mail", "suppressed", "throttled"],
    ],
  );
  assert.equal(third.channelCounts.mail.skipped_throttled, 1);
  assert.equal(third.channelCounts.inApp.sent, 1);
  assert.deepEqual(
    third.deliveries.map((row) => row.reason).sort(),
    ["throttled", "throttled"],
  );
});

test("untilRead: 既読の後と別の by の値はふつうに送る", async () => {
  const ctx = setup();
  await send(ctx, "1 通目");
  ctx.throttle.items[0].read = true;
  await send(ctx, "既読の後");
  await send(ctx, "別の部屋", "r2");
  assert.equal(ctx.throttle.items.length, 3);
  assert.ok(ctx.throttle.items.every((item) => item.collapsed_count === 1));
  assert.equal(mailSent(ctx), 3);
});

test("inApp の無い untilRead は window: seconds 以内は throttled、過ぎたらふつう", async () => {
  const ctx = setup();
  await send(ctx, "1", "r1", mailOnly);
  ctx.deps.setNow(later(599));
  const inside = await send(ctx, "2", "r1", mailOnly);
  ctx.deps.setNow(later(601));
  await send(ctx, "3", "r1", mailOnly);
  assert.equal(inside.deliveries[0].status, "suppressed");
  assert.equal(inside.deliveries[0].reason, "throttled");
  assert.equal(mailSent(ctx), 2);
  assert.equal(ctx.throttle.items.length, 0);
});

test("window: 未読があれば置き換え、既読なら新しいお知らせ、メールは window の間 throttled", async () => {
  const ctx = setup();
  await send(ctx, "1", "r1", windowed);
  ctx.deps.setNow(later(10));
  await send(ctx, "2", "r1", windowed);
  assert.equal(ctx.throttle.items.length, 1);
  assert.equal(ctx.throttle.items[0].collapsed_count, 2);
  ctx.throttle.items[0].read = true;
  ctx.deps.setNow(later(20));
  await send(ctx, "3", "r1", windowed);
  assert.equal(ctx.throttle.items.length, 2);
  assert.equal(ctx.throttle.items[1].collapsed_count, 1);
  assert.equal(mailSent(ctx), 1);
  // 置き換えは起点にしない: 最初の送り(0 秒)から 60 秒を過ぎたらメールが出る
  ctx.deps.setNow(later(61));
  await send(ctx, "4", "r1", windowed);
  assert.equal(mailSent(ctx), 2);
});

test("同時の 2 つの送り: 鍵の lock でお知らせ 1 つ・メール 1 通", async () => {
  const ctx = setup();
  const [a, b] = await Promise.all([send(ctx, "A"), send(ctx, "B")]);
  assert.equal(ctx.throttle.items.length, 1);
  assert.equal(ctx.throttle.items[0].collapsed_count, 2);
  assert.equal(mailSent(ctx), 1);
  const statuses = [...a.deliveries, ...b.deliveries].filter((row) => row.channel === "mail").map((row) => row.status).sort();
  assert.deepEqual(statuses, ["sent", "suppressed"]);
});

test("全員・ロール宛ての回は間引かない(共有の 1 行、メールも全部送る)", async () => {
  const ctx = setup();
  await ctx.sender.sendMessageToMany(chat, { audience: { type: "all" }, vars: { roomId: "r1", text: "全員" } });
  await ctx.sender.sendMessageToMany(chat, { audience: { type: "all" }, vars: { roomId: "r1", text: "全員 2" } });
  await sweepMessages(ctx.deps, { deadline: new Date(Date.now() + 60_000) });
  assert.equal(ctx.throttle.items.length, 0);
  assert.equal(ctx.world.inboxItems.length, 2);
  assert.ok(ctx.world.inboxItems.every((item) => item.user_id === null));
  assert.equal(mailSent(ctx), 6);
  assert.ok(ctx.world.store.deliveries.every((row) => row.throttle_key === null));
});

test("cron の送り: 束をまたいでも受信者ごとに 1 度だけ決め、次の回は置き換え + throttled", async () => {
  const ctx = setup(3);
  const recipients = ["u1", "u2", "u3"].map((userId) => ({ userId }));
  // 3 人 × 2 経路 = 6 行。要求の中は最初の 2 行、残りは cron
  await ctx.sender.sendMessageToMany(chat, { recipients, vars: { roomId: "r1", text: "1" } });
  await sweepMessages(ctx.deps, { deadline: new Date(Date.now() + 60_000) });
  assert.equal(ctx.throttle.items.length, 3);
  assert.equal(mailSent(ctx), 3);

  ctx.deps.setNow(later(30));
  const second = await ctx.sender.sendMessageToMany(chat, { recipients, vars: { roomId: "r1", text: "2" } });
  await sweepMessages(ctx.deps, { deadline: new Date(Date.now() + 60_000) });
  assert.equal(ctx.throttle.items.length, 3);
  assert.ok(ctx.throttle.items.every((item) => item.collapsed_count === 2 && item.body === "2"));
  assert.equal(mailSent(ctx), 3);
  const dispatch = ctx.world.store.dispatches.find((row) => row.id === second.dispatchId)!;
  assert.equal(dispatch.status, "completed");
  assert.equal(dispatch.channel_counts?.mail.skipped_throttled, 3);
  assert.equal(dispatch.channel_counts?.inApp.sent, 3);
});

// 予約(送る口の scheduledAt)の検査(メモリの store と掃き出し)
// - 回を status scheduled で作り、展開も送信もしない(宛先の一覧は回に置く)
// - 過ぎた時刻・config.schedule.maxDaysAhead より先は 400、本文を残せない連絡(required・秘密を差し込む)は予約できない
// - 時刻が来ると cron の activateScheduled が processing にし、展開して送る
// 実行: pnpm test src/features/core/messaging/services/server/sendMessage/schedule.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { createDefineMessage, secretVar, type MessageRegistry } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { sweepMessages } from "../sweep/sweep";
import { createMemoryWorld, createSweepDeps } from "../sweep/testHelpers";
import { createMessageSender } from "./sender";
import { createTestChannel } from "./testHelpers";

const fields = { test: z.object({ title: z.string(), body: z.string().optional() }).strict() };
const defineTestMessage = createDefineMessage<typeof fields>();
const notice = defineTestMessage({
  key: "shop.notice",
  label: "テストの連絡",
  category: "news",
  vars: z.object({ item: z.string() }),
  content: { test: { title: "{{item}}" } },
});
const secret = defineTestMessage({
  key: "shop.secret",
  label: "テストの連絡",
  category: "account",
  vars: z.object({ link: secretVar(z.string()) }),
  content: { test: { title: "{{link}}" } },
});
const registry: MessageRegistry = {
  "shop.notice": { key: "shop.notice", definition: async () => ({ message: notice }) },
};
const T0 = new Date("2026-11-10T00:00:00.000Z");
const later = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

function setup() {
  const world = createMemoryWorld();
  for (const id of ["u1", "u2"]) {
    world.store.users.push({ id, name: id, email: `${id}@example.test` });
    world.store.endpoints.push({ userId: id, channel: "test", address: `addr-${id}` });
  }
  const channel = createTestChannel("test");
  const deps = createSweepDeps(world, { channels: { test: channel }, registry });
  return { world, channel, deps, sender: createMessageSender(deps) };
}

async function rejects400(run: Promise<unknown>, message: RegExp) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.status, 400);
    assert.match(error.message, message);
    return true;
  });
}

test("予約: scheduled の回だけを作り、時刻に cron が展開して送る", async () => {
  const { world, deps, sender, channel } = setup();
  const result = await sender.sendMessageToMany(notice, {
    recipients: [{ userId: "u1" }, { userId: "u2" }],
    vars: { item: "靴" },
    scheduledAt: later(3600),
  });
  assert.equal(result.status, "scheduled");
  const dispatch = world.store.dispatches[0];
  assert.equal(dispatch.status, "scheduled");
  assert.deepEqual(dispatch.scheduled_at, later(3600));
  assert.deepEqual((dispatch.audience as { recipients: unknown[] }).recipients, [{ userId: "u1" }, { userId: "u2" }]);
  assert.equal(world.store.deliveries.length, 0);
  assert.equal(channel.calls.length, 0);

  await sweepMessages(deps, { deadline: new Date(Date.now() + 60_000) });
  assert.equal(dispatch.status, "scheduled");
  deps.setNow(later(3600));
  const swept = await sweepMessages(deps, { deadline: new Date(Date.now() + 60_000) });
  assert.equal(swept.activated, 1);
  assert.equal(dispatch.status, "completed");
  assert.equal(world.store.deliveries.filter((row) => row.status === "sent").length, 2);
});

test("予約: 過ぎた時刻・遠すぎる時刻・秘密を差し込む連絡は 400(回を作らない)", async () => {
  const { world, sender } = setup();
  const base = { recipients: [{ userId: "u1" }], vars: { item: "x" } };
  await rejects400(sender.sendMessageToMany(notice, { ...base, scheduledAt: T0 }), /過ぎて/);
  await rejects400(sender.sendMessageToMany(notice, { ...base, scheduledAt: later(-60) }), /過ぎて/);
  await rejects400(sender.sendMessageToMany(notice, { ...base, scheduledAt: later(31 * 24 * 3600) }), /30 日先/);
  await rejects400(sender.sendMessageToMany(notice, { ...base, scheduledAt: new Date("x") }), /正しくありません/);
  await rejects400(sender.sendMessageToMany(secret, { recipients: [{ userId: "u1" }], vars: { link: "https://x" }, scheduledAt: later(60) }), /予約できません/);
  assert.equal(world.store.dispatches.length, 0);
  // 上限ちょうどは通る
  const ok = await sender.sendMessageToMany(notice, { ...base, scheduledAt: later(30 * 24 * 3600) });
  assert.equal(ok.status, "scheduled");
});

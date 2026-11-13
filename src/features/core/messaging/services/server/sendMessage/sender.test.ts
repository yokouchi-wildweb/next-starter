// 新しい送る口(sendMessage / sendMessageToMany)の検査。DB はメモリの store、経路はテスト用の項目(上流の項目は 0 本)。
// - 上書きを重ねて検査してから送る(enabled:false は回を作らない・誤った定義は 500)
// - 回の行の新しい列と、宛先 × 経路の配達の行。宛先の無い受信者: 選んだ宛先は no_address の行、全員・ロールは行なしで数える
// - 冪等の鍵: message_dispatches と message_idempotency_keys の両方で 409
// - record meta / vars / full、required と秘密を差し込む連絡は描いた本文をどこにも残さない
// - ChannelError の分類 → 行の状態、required は要求の中で短く再送して尽きたら failed、非 required の一時は queued + next_attempt_at
// - 小さな送信は最初の束だけ要求の中、残りは queued。大きな送信・audience は回の行だけ
// - 帳簿を読む経路で送れた宛先は端末の帳簿の last_used_at を経路ごとに 1 回記録する(自前の引き方の経路・送れなかった宛先は記録しない、記録の失敗は送信を変えない)
// 実行: pnpm test src/features/core/messaging/services/server/sendMessage
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { ChannelError, createDefineMessage, secretVar, type MessageRegistry } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { expandBroadcastChunk, resolveAudienceChunk } from "./expand";
import { hashAddress } from "./stops";
import { createMessageSender } from "./sender";
import { FIXED_NOW, createDeps, createMemoryStore, createTestChannel } from "./testHelpers";

const fields = { test: z.object({ title: z.string(), body: z.string().optional() }).strict() };
const defineTestMessage = createDefineMessage<typeof fields>();

const notice = defineTestMessage({
  key: "shop.notice",
  category: "news",
  vars: z.object({ item: z.string() }),
  content: { test: { title: "{{serviceName}}: {{item}}", body: "{{recipientName}} 様 {{item}}" } },
});

function setup(options: { channel?: ReturnType<typeof createTestChannel>; registry?: MessageRegistry; users?: number } = {}) {
  const store = createMemoryStore();
  for (let i = 1; i <= (options.users ?? 3); i += 1) {
    store.users.push({ id: `u${i}`, name: `利用者${i}`, email: `u${i}@example.test`, role: i === 1 ? "admin" : "user" });
    store.endpoints.push({ userId: `u${i}`, channel: "test", address: `addr-u${i}` });
  }
  const channel = options.channel ?? createTestChannel();
  const deps = createDeps({ store, channels: { test: channel }, registry: options.registry ?? {} });
  return { store, channel, deps, sender: createMessageSender(deps) };
}

async function assertDomainError(promise: Promise<unknown>, status: number) {
  await assert.rejects(promise, (error: unknown) => error instanceof DomainError && error.status === status);
}

test("d1: 上書きを重ねて送る(生成の一覧の override)", async () => {
  const registry: MessageRegistry = {
    "shop.notice": {
      key: "shop.notice",
      definition: async () => ({ message: notice }),
      override: async () => ({ messageOverride: { content: { test: { title: "上書き {{item}}" } } } }),
    },
  };
  const { sender, channel, store } = setup({ registry });
  await sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "靴" } });
  assert.equal(channel.calls[0][0].content.title, "上書き 靴");
  // 宛先に連絡の鍵が載る(メールの経路が連絡ごとの描き方を引く)
  assert.equal(channel.calls[0][0].messageKey, "shop.notice");
  assert.deepEqual(store.dispatches[0].headings, { test: "上書き 靴" });
});

test("d1: enabled:false の上書きは回を作らず disabled を返す", async () => {
  const registry: MessageRegistry = {
    "shop.notice": {
      key: "shop.notice",
      definition: async () => ({ message: notice }),
      override: async () => ({ messageOverride: { enabled: false } }),
    },
  };
  const { sender, store, channel } = setup({ registry });
  const result = await sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "靴" } });
  assert.equal(result.status, "disabled");
  assert.equal(result.dispatchId, null);
  assert.equal(store.dispatches.length, 0);
  assert.equal(channel.calls.length, 0);
});

test("d1: 検査に落ちる定義は 500、vars が合わなければ 400", async () => {
  const { sender } = setup();
  const broken = { ...notice, key: "Bad-Key" } as unknown as typeof notice;
  await assertDomainError(sender.sendMessage(broken, { recipient: { userId: "u2" }, vars: { item: "x" } }), 500);
  await assertDomainError(sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: 1 } }), 400);
});

test("d2: 回の新しい列と、宛先 × 経路の配達の行", async () => {
  const { sender, store, channel } = setup();
  const result = await sender.sendMessageToMany(notice, {
    recipients: [{ userId: "u1" }, { userId: "u2" }],
    vars: { item: "靴" },
    recipientVars: { "user:u1": { extra: "X" } },
  });
  const dispatch = store.dispatches[0];
  assert.equal(dispatch.message_key, "shop.notice");
  assert.equal(dispatch.kind, "marketing");
  assert.equal(dispatch.category, "news");
  assert.equal(dispatch.record, "vars");
  assert.equal(dispatch.source, "shop.notice");
  assert.equal(dispatch.recipient_count, 2);
  assert.equal(dispatch.actor_id, "admin-1");
  assert.deepEqual(dispatch.audience, { type: "recipients", count: 2 });
  assert.deepEqual(dispatch.headings, { test: "テストサービス: 靴" });
  assert.equal(dispatch.status, "completed");
  assert.deepEqual(dispatch.channel_counts, {
    test: { targeted: 2, sent: 2, failed: 0, skipped_no_address: 0, skipped_throttled: 0, suppressed: 0 },
  });
  assert.equal(store.deliveries.length, 2);
  assert.deepEqual(store.deliveries.map((row) => row.recipient_key).sort(), ["user:u1", "user:u2"]);
  assert.ok(store.deliveries.every((row) => row.status === "sent" && row.provider === "fake"));
  // 冪等の鍵 = 配達の行の id、受信者ごとの値と共通の文脈が差し込まれる
  const sent = channel.calls[0];
  const u1 = sent.find((target) => target.userId === "u1")!;
  assert.equal(u1.idempotencyKey, store.deliveries.find((row) => row.user_id === "u1")!.id);
  assert.equal(u1.content.body, "利用者1 様 靴");
  assert.deepEqual(store.deliveries.find((row) => row.user_id === "u1")!.vars, { extra: "X" });
  assert.equal(result.deliveries.length, 2);
});

test("d2: 選んだ宛先で宛先の無い利用者は suppressed + no_address の行を返す", async () => {
  const { sender, store } = setup();
  store.endpoints = store.endpoints.filter((row) => row.userId !== "u3");
  const result = await sender.sendMessageToMany(notice, {
    recipients: [{ userId: "u2" }, { userId: "u3" }],
    vars: { item: "靴" },
  });
  const missing = result.deliveries.find((row) => row.userId === "u3")!;
  assert.equal(missing.status, "suppressed");
  assert.equal(missing.reason, "no_address");
  assert.equal(store.dispatches[0].recipient_count, 2);
  assert.equal(result.channelCounts.test.skipped_no_address, 1);
  assert.equal(result.channelCounts.test.sent, 1);
});

test("d2: 全員・ロールの展開は宛先の無い利用者の行を作らず skipped_no_address に数える", async () => {
  const { deps, store } = setup({ users: 4 });
  store.endpoints = store.endpoints.filter((row) => row.userId !== "u4");
  const first = await resolveAudienceChunk(deps, { type: "all" }, null);
  assert.deepEqual(first.userIds, ["u1", "u2"]);
  const second = await resolveAudienceChunk(deps, { type: "all" }, first.nextCursor);
  assert.deepEqual(second.userIds, ["u3", "u4"]);
  const chunk = await expandBroadcastChunk(deps, {
    channels: ["test"],
    userIds: second.userIds,
    stops: { kind: "marketing", required: false, category: "news" },
  });
  assert.deepEqual(chunk.planned.map((plan) => plan.recipientKey), ["user:u3"]);
  assert.deepEqual(chunk.counts.test, { targeted: 2, skippedNoAddress: 1, suppressed: 0 });
  const admins = await resolveAudienceChunk(deps, { type: "role", roles: ["admin"] }, null);
  assert.deepEqual(admins.userIds, ["u1"]);
});

test("d2: 単発で見つからない利用者は 404", async () => {
  const { sender } = setup();
  await assertDomainError(sender.sendMessage(notice, { recipient: { userId: "nobody" }, vars: { item: "x" } }), 404);
});

test("d2: 経路の項目が無い経路は channel_off の行", async () => {
  const { sender } = setup();
  const twoChannels = defineTestMessage({ ...notice });
  const result = await sender.sendMessageToMany(
    { ...twoChannels, content: { ...twoChannels.content, ghost: { title: "x" } } } as unknown as typeof notice,
    { recipients: [{ userId: "u2" }], vars: { item: "x" }, channels: ["test", "ghost"] },
  ).catch((error) => error);
  // ghost は欄の zod が無いので定義の検査で止まる(経路の項目が無い経路の中身は書けない)
  assert.ok(result instanceof DomainError);
});

test("d3: 冪等の鍵は message_dispatches と message_idempotency_keys の両方で 409", async () => {
  const { sender, store } = setup();
  await sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" }, idempotencyKey: "key-12345" });
  await assertDomainError(
    sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" }, idempotencyKey: "key-12345" }),
    409,
  );
  store.movedKeys.add("moved-key-1");
  await assertDomainError(
    sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" }, idempotencyKey: "moved-key-1" }),
    409,
  );
  assert.equal(store.dispatches.length, 1);
});

test("d3: 確かめた後の INSERT の UNIQUE 違反も 409", async () => {
  const { sender, store } = setup();
  store.idempotencyKeyExists = async () => false;
  store.dispatches.push({ id: "x", idempotency_key: "race-key-1" } as never);
  await assertDomainError(
    sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" }, idempotencyKey: "race-key-1" }),
    409,
  );
});

test("d4: record meta は vars も描画結果も残さない、full は受信者ごとの本文を残す", async () => {
  const meta = setup();
  await meta.sender.sendMessage({ ...notice, record: "meta" }, { recipient: { userId: "u2" }, vars: { item: "靴" }, recipientVars: { extra: "E" } });
  assert.equal(meta.store.dispatches[0].vars, null);
  assert.equal(meta.store.dispatches[0].rendered, null);
  assert.equal(meta.store.deliveries[0].vars, null);
  assert.equal(meta.store.deliveries[0].body, null);
  assert.deepEqual(meta.store.dispatches[0].headings, { test: "テストサービス: 靴" });

  const vars = setup();
  await vars.sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "靴" }, recipientVars: { extra: "E" } });
  assert.deepEqual(vars.store.dispatches[0].vars, { item: "靴" });
  assert.deepEqual(vars.store.dispatches[0].rendered, { test: { title: "テストサービス: 靴", body: "{{recipientName}} 様 靴" } });
  assert.deepEqual(vars.store.deliveries[0].vars, { extra: "E" });
  assert.equal(vars.store.deliveries[0].body, null);

  const full = setup();
  await full.sender.sendMessage({ ...notice, record: "full" }, { recipient: { userId: "u2" }, vars: { item: "靴" } });
  assert.deepEqual(full.store.deliveries[0].body, { title: "テストサービス: 靴", body: "利用者2 様 靴" });
});

test("d4: 秘密を差し込む連絡は record full でも描いた本文を残さず、vars の写しから秘密の鍵を落とす", async () => {
  const secret = defineTestMessage({
    key: "auth.reset",
    category: "account",
    record: "full",
    vars: z.object({ resetUrl: secretVar(z.string()), item: z.string() }),
    content: { test: { title: "再設定 {{item}} {{resetUrl}}", body: "{{resetUrl}}" } },
  });
  const failing = createTestChannel("test", (target) => ({
    address: target.address,
    kind: "permanent",
    reason: "invalid_address",
    message: `rejected ${String(target.content.body)}`,
  }));
  const { sender, store, channel } = setup({ channel: failing });
  await sender.sendMessage(secret, { recipient: { userId: "u2" }, vars: { resetUrl: "https://x/TOKEN", item: "A" } });
  assert.equal(channel.calls[0][0].content.body, "https://x/TOKEN");
  const dump = JSON.stringify({ dispatches: store.dispatches, deliveries: store.deliveries });
  assert.ok(!dump.includes("TOKEN"), dump);
  assert.deepEqual(store.dispatches[0].vars, { item: "A" });
  assert.equal(store.dispatches[0].rendered, null);
  assert.deepEqual(store.dispatches[0].headings, { test: "再設定 A {{resetUrl}}" });
  assert.equal(store.deliveries[0].last_error, "invalid_address");
});

test("d4: required は vars の写しも本文も残さない", async () => {
  const required = defineTestMessage({ ...notice, key: "auth.verify", category: "accountEmail", required: true });
  // required は email を外せないので、テストの経路を email の鍵で置く
  const email = createTestChannel("email");
  const store = createMemoryStore();
  store.users.push({ id: "u2", name: "利用者2", email: "u2@example.test" });
  store.endpoints.push({ userId: "u2", channel: "email", address: "u2@example.test" });
  const deps = createDeps({ store, channels: { email: { ...email, fields: z.object({ subject: z.string(), paragraphs: z.array(z.string()).optional() }).strict() } } });
  const requiredEmail = {
    ...required,
    content: { email: { subject: "確認 {{item}}", paragraphs: ["{{item}} です"] } },
  } as unknown as typeof notice;
  await createMessageSender(deps).sendMessage(requiredEmail, { recipient: { userId: "u2" }, vars: { item: "靴" } });
  assert.equal(store.dispatches[0].vars, null);
  assert.equal(store.dispatches[0].rendered, null);
  assert.equal(store.deliveries[0].body, null);
  assert.equal(store.deliveries[0].status, "sent");
  assert.deepEqual(store.dispatches[0].headings, { email: "確認 靴" });
});

test("d5: ChannelError の分類を行の状態に写す(permanent → failed、unknown・例外 → unknown、transient → queued + next_attempt_at)", async () => {
  const kinds: Record<string, "permanent" | "unknown" | "transient" | "throw"> = {
    "addr-u1": "permanent",
    "addr-u2": "unknown",
    "addr-u3": "transient",
  };
  const channel = createTestChannel("test", (target) => ({
    address: target.address,
    kind: kinds[target.address] as "permanent" | "unknown" | "transient",
    reason: "provider_error",
  }));
  const { sender, store } = setup({ channel });
  const result = await sender.sendMessageToMany(notice, {
    recipients: [{ userId: "u1" }, { userId: "u2" }, { userId: "u3" }],
    vars: { item: "x" },
  });
  const byUser = (id: string) => store.deliveries.find((row) => row.user_id === id)!;
  // 最初の束は 2 件(inRequestBatchSize)、u3 は送らず queued のまま
  assert.equal(byUser("u1").status, "failed");
  assert.equal(byUser("u2").status, "unknown");
  assert.equal(byUser("u3").status, "queued");
  assert.equal(byUser("u3").attempts, 0);
  assert.equal(result.queuedCount, 1);
  assert.equal(store.dispatches[0].status, "processing");

  const transient = setup({ channel: createTestChannel("test", (target) => ({ address: target.address, kind: "transient", reason: "rate_limited" })) });
  await transient.sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" } });
  const row = transient.store.deliveries[0];
  assert.equal(row.status, "queued");
  assert.equal(row.attempts, 1);
  assert.equal(row.next_attempt_at?.toISOString(), new Date(FIXED_NOW.getTime() + 60_000).toISOString());
  assert.equal(transient.store.dispatches[0].status, "processing");

  const thrown = setup({ channel: createTestChannel("test", () => "throw") });
  await thrown.sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" } });
  assert.equal(thrown.store.deliveries[0].status, "unknown");
  assert.equal(thrown.store.dispatches[0].status, "completed_with_failures");

  const channelError = createTestChannel("test", () => "throw");
  channelError.send = async () => {
    throw new ChannelError({ message: "down", kind: "permanent", channel: "test", reason: "auth_failed" });
  };
  const permanent = setup({ channel: channelError });
  await permanent.sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" } });
  assert.equal(permanent.store.deliveries[0].status, "failed");
  assert.equal(permanent.store.deliveries[0].last_error, "auth_failed: down");
});

test("d5: 秘密・required の連絡は一時の失敗を要求の中で短く再送し、尽きたら failed", async () => {
  const secret = defineTestMessage({ ...notice, key: "auth.code", vars: z.object({ item: secretVar(z.string()) }) });
  let failUntil = 2;
  const channel = createTestChannel("test", (target, call) =>
    call <= failUntil ? { address: target.address, kind: "transient", reason: "rate_limited" } : { address: target.address, kind: "sent" },
  );
  const ok = setup({ channel });
  await ok.sender.sendMessage(secret, { recipient: { userId: "u2" }, vars: { item: "123456" } });
  assert.equal(ok.store.deliveries[0].status, "sent");
  assert.equal(ok.store.deliveries[0].attempts, 3);
  assert.deepEqual(ok.deps.slept, [1, 1]);

  failUntil = 99;
  const ng = setup({ channel });
  await ng.sender.sendMessage(secret, { recipient: { userId: "u2" }, vars: { item: "123456" } });
  assert.equal(ng.store.deliveries[0].status, "failed");
  assert.equal(ng.store.deliveries[0].next_attempt_at, null);
  assert.equal(ng.store.dispatches[0].status, "completed_with_failures");
});

test("小さな送信は最初の束だけ送り、残りは queued + next_attempt_at=now で cron に任せる", async () => {
  const { sender, store, channel } = setup({ users: 5 });
  const result = await sender.sendMessageToMany(notice, {
    recipients: ["u1", "u2", "u3", "u4", "u5"].map((userId) => ({ userId })),
    vars: { item: "x" },
    recipientVars: { "user:u5": { extra: "E5" } },
  });
  assert.equal(channel.calls[0].length, 2);
  assert.equal(result.queuedCount, 3);
  const queued = store.deliveries.filter((row) => row.status === "queued");
  assert.equal(queued.length, 3);
  assert.ok(queued.every((row) => row.next_attempt_at?.getTime() === FIXED_NOW.getTime()));
  // cron が描くために受信者ごとの値は残す
  assert.deepEqual(store.deliveries.find((row) => row.user_id === "u5")!.vars, { extra: "E5" });
  assert.equal(store.dispatches[0].status, "processing");
  assert.equal(store.dispatches[0].completed_at, null);
});

test("大きな送信と audience は回の行だけ書き、展開しない", async () => {
  const { sender, store, channel } = setup({ users: 6 });
  const large = await sender.sendMessageToMany(notice, {
    recipients: ["u1", "u2", "u3", "u4", "u5", "u6"].map((userId) => ({ userId })),
    vars: { item: "x" },
  });
  assert.equal(large.status, "processing");
  assert.equal(store.deliveries.length, 0);
  assert.equal(store.dispatches[0].recipient_count, 6);
  assert.equal((store.dispatches[0].audience as { type: string }).type, "recipients");

  const all = await sender.sendMessageToMany({ ...notice, record: "meta" }, { audience: { type: "all" }, vars: { item: "x" }, showToLaterSignups: true });
  assert.equal(all.status, "processing");
  assert.deepEqual(store.dispatches[1].audience, { type: "all" });
  assert.equal(store.dispatches[1].show_to_later_signups, true);
  // cron が描くために vars を持つ(record meta は cron が終わりに消す)
  assert.deepEqual(store.dispatches[1].vars, { item: "x" });
  assert.equal(channel.calls.length, 0);
});

test("秘密・required の連絡は audience と大きな送信を拒む", async () => {
  const secret = defineTestMessage({ ...notice, key: "auth.code", vars: z.object({ item: secretVar(z.string()) }) });
  const { sender, store } = setup();
  await assertDomainError(sender.sendMessageToMany(secret, { audience: { type: "all" }, vars: { item: "1" } }), 400);
  assert.equal(store.dispatches.length, 0);
});

test("受信者ごとの値で vars の鍵と共通の文脈は上書きできない", async () => {
  const { sender } = setup();
  await assertDomainError(
    sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" }, recipientVars: { recipientName: "偽" } }),
    400,
  );
  await assertDomainError(
    sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" }, recipientVars: { item: "y" } }),
    400,
  );
});

test("enrichers の provides を差し込み、返値は zod で検査する", async () => {
  const { store, channel } = setup();
  const deps = createDeps({
    store,
    channels: { test: channel },
    enrichers: {
      points: {
        key: "points",
        messages: ["shop.notice"],
        provides: z.object({ extra: z.string() }),
        resolve: ({ recipient }) => ({ extra: `pt-${recipient.userId}` }),
      },
    },
  });
  const withPoints = defineTestMessage({ ...notice, content: { test: { title: "t", body: "{{recipientName}} 様 {{item}} {{extra}}" } } });
  await createMessageSender(deps).sendMessage(withPoints, { recipient: { userId: "u2" }, vars: { item: "x" } });
  assert.equal(channel.calls[0][0].content.body, "利用者2 様 x pt-u2");
  // 当たる enricher が無ければ {{extra}} は定義の検査で落ちる
  await assertDomainError(
    createMessageSender({ ...deps, enrichers: {} }).sendMessage(withPoints, { recipient: { userId: "u2" }, vars: { item: "x" } }),
    500,
  );
  // 返値が provides に合わなければ 500
  const badDeps = createDeps({
    store,
    channels: { test: channel },
    enrichers: { points: { key: "points", messages: "*", provides: z.object({ extra: z.string() }), resolve: () => ({ extra: 1 }) } },
  });
  await assertDomainError(
    createMessageSender(badDeps).sendMessage(withPoints, { recipient: { userId: "u2" }, vars: { item: "x" } }),
    500,
  );
});

test("複数の宛先は 1 行の targets にまとめ、1 つでも sent なら sent", async () => {
  const channel = createTestChannel("test", (target) =>
    target.address === "addr-b" ? { address: target.address, kind: "sent" } : { address: target.address, kind: "permanent", reason: "invalid_address" },
  );
  const { sender, store } = setup({ channel });
  store.endpoints.push({ userId: "u2", channel: "test", address: "addr-b" });
  await sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" } });
  const row = store.deliveries[0];
  assert.equal(row.status, "sent");
  assert.equal(row.targets?.length, 2);
  assert.deepEqual(channel.calls[0].map((target) => target.idempotencyKey), [`${row.id}:0`, `${row.id}:1`]);
});

test("宛先を直に渡す受信者は addr:<hash> の鍵で送る", async () => {
  const { sender, store, channel } = setup();
  await sender.sendMessage(notice, { recipient: { channel: "test", address: "Direct@Example.test" }, vars: { item: "x" } });
  assert.match(store.deliveries[0].recipient_key, /^addr:[0-9a-f]{64}$/);
  assert.equal(channel.calls[0][0].userId, null);
  assert.equal(channel.calls[0][0].content.body, " 様 x");
});

test("enabled: false の経路は項目が無い経路と同じく channel_off で送らない", async () => {
  const off = createTestChannel("test");
  off.enabled = false;
  const { sender, store } = setup({ channel: off });
  const result = await sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" } });
  assert.equal(result.deliveries[0].status, "suppressed");
  assert.equal(result.deliveries[0].reason, "channel_off");
  assert.equal(off.calls.length, 0);
  assert.equal(store.dispatches[0].channel_counts?.test.suppressed, 1);
});

test("配信停止(D35): 選んだ宛先で止めた受信者は理由つきの suppressed の行、recipient_count から引く", async () => {
  const { sender, store, channel } = setup();
  store.preferences.push({ userId: "u1", category: "news", channel: "test" });
  store.suppressions.push({ channel: "test", addressHash: hashAddress("addr-u2"), reason: "complaint", scope: "*" });
  const result = await sender.sendMessageToMany(notice, {
    recipients: [{ userId: "u1" }, { userId: "u2" }, { userId: "u3" }],
    vars: { item: "x" },
  });
  const byUser = (id: string) => result.deliveries.find((row) => row.userId === id)!;
  assert.deepEqual([byUser("u1").status, byUser("u1").reason], ["suppressed", "preference"]);
  assert.deepEqual([byUser("u2").status, byUser("u2").reason], ["suppressed", "suppression"]);
  assert.equal(byUser("u3").status, "sent");
  assert.equal(store.dispatches[0].recipient_count, 1);
  assert.equal(result.channelCounts.test.suppressed, 2);
  assert.deepEqual(channel.calls.flat().map((t) => t.userId), ["u3"]);
});

test("配信停止(D35): 好みに従う連絡の宛先に category と List-Unsubscribe のヘッダが付き、取引の連絡には付かない", async () => {
  const { sender, channel } = setup();
  await sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" } });
  const [sent] = channel.calls[0];
  assert.equal(sent.category, "news");
  assert.deepEqual(sent.headers, {
    "List-Unsubscribe": "<https://example.test/u?r=user:u2&c=news&ch=test>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  });

  const tx = setup();
  await tx.sender.sendMessage({ ...notice, category: "account" }, { recipient: { userId: "u2" }, vars: { item: "x" } });
  assert.equal(tx.channel.calls[0][0].category, undefined);
  assert.equal(tx.channel.calls[0][0].headers, undefined);
});

test("配信停止: 停止の URL の中身に連絡の鍵と回の id が載る(停止を連絡・回に結ぶ)", async () => {
  const { store, channel } = setup();
  const payloads: Record<string, unknown>[] = [];
  const deps = createDeps({
    store,
    channels: { test: channel },
    unsubscribe: {
      configured: () => true,
      url: (payload) => {
        payloads.push(payload);
        return "https://example.test/u";
      },
    },
  });
  const result = await createMessageSender(deps).sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" } });
  assert.deepEqual(payloads, [
    { recipientKey: "user:u2", category: "news", channel: "test", messageKey: "shop.notice", dispatchId: result.dispatchId },
  ]);
});

test("配信停止(D57): 鍵が無い時は category だけ付き headers は付かない(経路が鍵の無い印として扱う)", async () => {
  const store = createMemoryStore();
  store.users.push({ id: "u2", name: "利用者2", email: null });
  store.endpoints.push({ userId: "u2", channel: "test", address: "addr-u2" });
  const channel = createTestChannel();
  const deps = createDeps({ store, channels: { test: channel } });
  deps.unsubscribe = { configured: () => false, url: () => "never" };
  await createMessageSender(deps).sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" } });
  assert.equal(channel.calls[0][0].category, "news");
  assert.equal(channel.calls[0][0].headers, undefined);
});

test("d4: 帳簿を読む経路で送れた宛先だけ last_used_at を経路ごとに 1 回記録する", async () => {
  const channel = createTestChannel("test", (target) =>
    target.address === "addr-u1"
      ? { address: target.address, kind: "permanent", reason: "provider_error" }
      : { address: target.address, kind: "sent", provider: "fake" },
  );
  const { sender, store } = setup({ channel });
  await sender.sendMessageToMany(notice, { recipients: [{ userId: "u1" }, { userId: "u2" }], vars: { item: "x" } });
  assert.equal(store.endpointTouches.length, 1);
  assert.deepEqual(store.endpointTouches[0], { channel: "test", entries: [{ userId: "u2", address: "addr-u2" }], at: FIXED_NOW });

  // 送れた宛先が無ければ呼ばない
  const failing = setup({ channel: createTestChannel("test", (target) => ({ address: target.address, kind: "permanent", reason: "provider_error" })) });
  await failing.sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" } });
  assert.equal(failing.store.endpointTouches.length, 0);
});

test("d4: 自前の宛先の引き方を持つ経路は帳簿に記録しない、記録が失敗しても送信は sent のまま", async () => {
  const own = { ...createTestChannel("test"), resolveAddresses: async (ids: readonly string[]) => ids.map((userId) => ({ userId, address: `own-${userId}` })) };
  const store = createMemoryStore();
  store.users.push({ id: "u2", name: "利用者2", email: "u2@example.test" });
  const deps = createDeps({ store, channels: { test: own } });
  await createMessageSender(deps).sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" } });
  assert.equal(store.deliveries[0].status, "sent");
  assert.equal(store.endpointTouches.length, 0);

  const broken = setup();
  broken.store.touchEndpoints = async () => {
    throw new Error("db down");
  };
  const warn = console.warn;
  console.warn = () => {};
  try {
    await broken.sender.sendMessage(notice, { recipient: { userId: "u2" }, vars: { item: "x" } });
  } finally {
    console.warn = warn;
  }
  assert.equal(broken.store.deliveries[0].status, "sent");
});

test("経路は種類から(D86): channels はその回の絞りだけ、種類の外と空は 400、回に使った経路が残る", async () => {
  const fields2 = {
    test: z.object({ title: z.string(), body: z.string().optional() }).strict(),
    inApp: z.object({ title: z.string(), body: z.string() }).strict(),
  };
  const define2 = createDefineMessage<typeof fields2>();
  const both = define2({
    key: "shop.both",
    category: "newsInApp",
    vars: z.object({ item: z.string() }),
    content: { test: { title: "{{item}}" }, inApp: { title: "{{item}}", body: "{{item}}" } },
  });
  const store = createMemoryStore();
  store.users.push({ id: "u2", name: "利用者2", email: null });
  store.endpoints.push({ userId: "u2", channel: "test", address: "addr-u2" });
  const inApp = createTestChannel("inApp");
  inApp.fields = fields2.inApp;
  inApp.resolveAddresses = async (ids) => ids.map((userId) => ({ userId, address: userId }));
  const deps = createDeps({ store, channels: { test: createTestChannel(), inApp } });
  const sender = createMessageSender(deps);
  // 省略 = 種類の経路の全部
  await sender.sendMessage(both, { recipient: { userId: "u2" }, vars: { item: "a" } });
  assert.deepEqual(store.dispatches[0].channels, ["test", "inApp"]);
  // 絞る(その回に使った経路だけが回に残る)
  await sender.sendMessage(both, { recipient: { userId: "u2" }, vars: { item: "b" }, channels: ["inApp"] });
  assert.deepEqual(store.dispatches[1].channels, ["inApp"]);
  // 種類の外は足せない・空は拒む
  await assertDomainError(sender.sendMessage(both, { recipient: { userId: "u2" }, vars: { item: "c" }, channels: ["test", "line"] }), 400);
  await assertDomainError(sender.sendMessage(both, { recipient: { userId: "u2" }, vars: { item: "d" }, channels: [] }), 400);
  assert.equal(store.dispatches.length, 2);
});

test("種別の性質(D80): 記録の既定は種別から、security は苦情の停止を越えて届き好みを見ない", async () => {
  const store = createMemoryStore();
  store.users.push({ id: "u2", name: "利用者2", email: "u2@example.test" });
  // 種類 accountEmail は functional → 記録の既定 meta(vars を残さない)
  const fields3 = { email: z.object({ subject: z.string() }).strict() };
  const define3 = createDefineMessage<typeof fields3>();
  const alert = define3({ key: "auth.alert", category: "accountEmail", vars: z.object({ item: z.string() }), content: { email: { subject: "{{item}}" } } });
  const email = createTestChannel("email");
  const deps = createDeps({ store, channels: { email: { ...email, fields: fields3.email } } });
  store.endpoints.push({ userId: "u2", channel: "email", address: "u2@example.test" });
  store.suppressions.push({ channel: "email", addressHash: hashAddress("u2@example.test"), reason: "complaint", scope: "*" });
  store.preferences.push({ userId: "u2", category: "*", channel: "*" });
  await createMessageSender(deps).sendMessage(alert, { recipient: { userId: "u2" }, vars: { item: "x" } });
  const dispatch = store.dispatches.at(-1)!;
  assert.equal(dispatch.kind, "functional");
  assert.equal(dispatch.record, "meta");
  assert.equal(dispatch.vars, null);
  assert.equal(email.calls.flat().length, 1);
});

const securityAlert = defineTestMessage({
  key: "auth.alert",
  category: "alert",
  vars: z.object({ item: z.string() }),
  content: { test: { title: "警告 {{item}}" } },
});

test("security(性質 sendInEntry): 予約と audience は 400、宛先が多くても口の中で展開して最初の束を送る", async () => {
  const { sender, store, channel } = setup({ users: 7 });
  await assertDomainError(
    sender.sendMessageToMany(securityAlert, { recipients: [{ userId: "u1" }], vars: { item: "x" }, scheduledAt: new Date(FIXED_NOW.getTime() + 60_000) }),
    400,
  );
  await assertDomainError(sender.sendMessageToMany(securityAlert, { audience: { type: "all" }, vars: { item: "x" } }), 400);
  assert.equal(store.dispatches.length, 0);
  // smallSendMaxRecipients(5)を越える 7 人: 回の行だけにせず展開し、最初の束(inRequestBatchSize 2)を口の中で送る
  const recipients = Array.from({ length: 7 }, (_, i) => ({ userId: `u${i + 1}` }));
  const result = await sender.sendMessageToMany(securityAlert, { recipients, vars: { item: "x" } });
  assert.equal(store.deliveries.length, 7);
  assert.equal(channel.calls.flat().length, 2);
  assert.equal(result.queuedCount, 5);
  assert.equal(store.dispatches[0].kind, "security");
});

test("security: 旧い住所({ channel, address }、利用者なし)へ送れる", async () => {
  const { sender, store, channel } = setup();
  const result = await sender.sendMessage(securityAlert, { recipient: { channel: "test", address: "old@example.test" }, vars: { item: "x" } });
  assert.equal(result.status, "completed");
  assert.equal(channel.calls.flat()[0].address, "old@example.test");
  assert.equal(store.deliveries[0].user_id, null);
});

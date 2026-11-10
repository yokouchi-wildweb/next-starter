// src/lib/messaging/receptacles.test.ts
//
// messaging の受け口の項目の型(receptacles/types.ts)の検査。正しい項目が通り、欠けた欄・誤った種別は型検査で止まる(@ts-expect-error)。
// 実行は項目を作って最小の呼び出しをするだけ(読み手は連絡のドメインの作り直しで作る)。
// 実行: pnpm test src/lib/messaging/receptacles.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import type {
  ChannelSendResult,
  MessageAudience,
  MessageCategory,
  MessageChannel,
  MessageEnricher,
  MessageSource,
  MessageSubscriber,
} from "./index";

test("経路: 宛先ごとの結果を返す", async () => {
  const channel: MessageChannel = {
    key: "push",
    label: "プッシュ通知",
    addressing: "user",
    fields: z.object({ title: z.string(), body: z.string() }).strict(),
    contentFrom: { channel: "inApp", map: { title: "title", body: "body" } },
    send: async (targets) =>
      targets.map((t): ChannelSendResult =>
        t.address === "bad"
          ? { address: t.address, kind: "permanent", reason: "invalid_token", addressInvalid: true }
          : { address: t.address, kind: "sent", provider: "fcm", providerMessageId: "m1" },
      ),
    webhooks: {
      fcm: { verify: () => ({}), normalize: () => [] },
    },
  };
  const results = await channel.send([
    { userId: "u1", address: "ok", idempotencyKey: "d1:ok", content: { title: "t", body: "b" } },
    { userId: "u1", address: "bad", idempotencyKey: "d1:bad", content: { title: "t", body: "b" } },
  ]);
  assert.deepEqual(results.map((r) => r.kind), ["sent", "permanent"]);

  // @ts-expect-error 宛先の決め方は user / address だけ
  const wrongAddressing: MessageChannel = { ...channel, addressing: "device" };
  // @ts-expect-error 失敗の分類は sent / transient / permanent / unknown だけ
  const wrongKind: ChannelSendResult = { address: "a", kind: "retry", reason: "x" };
  // 入切は任意の真偽(既定 true)
  const off: MessageChannel = { ...channel, enabled: false };
  // @ts-expect-error 入切は真偽だけ
  const wrongEnabled: MessageChannel = { ...channel, enabled: "off" };
  assert.ok(off && wrongEnabled);
  // @ts-expect-error send は必須
  const noSend: MessageChannel = { key: "x", label: "x", addressing: "user", fields: z.object({}) };
  assert.ok(wrongAddressing && wrongKind && noSend);
});

test("値・種類・宛先の集め方・送り元・購読", async () => {
  const enricher: MessageEnricher = {
    key: "rank",
    messages: ["auth.verification"],
    provides: z.object({ rankName: z.string() }),
    resolve: () => ({ rankName: "ゴールド" }),
  };
  assert.deepEqual(
    await enricher.resolve({ messageKey: "auth.verification", recipient: { userId: "u1", name: null, email: null }, vars: {} }),
    { rankName: "ゴールド" },
  );

  const category: MessageCategory = { key: "campaign", label: "キャンペーン", kind: "marketing" };
  // @ts-expect-error 取引の種別は種類を持たない(好みを見ない)
  const transactional: MessageCategory = { key: "x", label: "x", kind: "transactional" };

  const audience: MessageAudience = {
    key: "activeUsers",
    label: "有効な利用者",
    args: z.object({ since: z.string() }),
    resolveUserIds: async (_args, cursor) => (cursor === null ? { userIds: ["u1", "u2"], nextCursor: "u2" } : { userIds: [], nextCursor: null }),
  };
  assert.deepEqual(await audience.resolveUserIds({}, null), { userIds: ["u1", "u2"], nextCursor: "u2" });

  const source: MessageSource = { key: "shippingRequest.bulk", label: "発送リクエストの一斉送信" };

  const seen: string[] = [];
  const subscriber: MessageSubscriber = {
    key: "crmForward",
    on: ["delivery.sent", "email.opened"],
    filter: { channels: ["email"] },
    handle: async (events) => {
      for (const e of events) seen.push(`${e.type}:${e.id}`);
    },
  };
  await subscriber.handle([
    { id: "e1", type: "delivery.sent", messageKey: "auth.verification", dispatchId: "d1", deliveryId: "v1", channel: "email", occurredAt: new Date(0), payload: {} },
  ]);
  assert.deepEqual(seen, ["delivery.sent:e1"]);

  // @ts-expect-error 当てる連絡は "*" か鍵(<domain>.<name>)の配列
  const badEnricher: MessageEnricher = { ...enricher, messages: ["noDot"] };
  assert.ok(category && transactional && source && badEnricher);
});

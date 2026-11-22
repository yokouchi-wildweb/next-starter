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
  ChannelSendTarget,
  MessageCategory,
  MessageChannel,
  MessageEnricher,
  MessageSource,
  MessageSubscriber,
} from "./index";
import { categoryAdminLabel, enricherTargets } from "./index";

test("送信チャンネル: 宛先ごとの結果を返す(送信チャンネルは自分の欄を持たない。中身はレイアウト、D122)", async () => {
  const channel: MessageChannel = {
    key: "push",
    label: "プッシュ通知",
    addressing: "user",
    // 要約から描ける(描き方の 3 段の 3 段目、D124)
    summaryRenderable: true,
    renderFromSummary: (summary) => ({ content: { title: summary.title, body: summary.shortBody ?? summary.body } }),
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
    { userId: "u1", address: "ok", messageKey: "auth.verification", idempotencyKey: "d1:ok", content: { title: "t", body: "b" } },
    { userId: "u1", address: "bad", messageKey: "auth.verification", idempotencyKey: "d1:bad", content: { title: "t", body: "b" } },
  ]);
  assert.deepEqual(results.map((r) => r.kind), ["sent", "permanent"]);

  // @ts-expect-error 宛先の決め方は user / address だけ
  const wrongAddressing: MessageChannel = { ...channel, addressing: "device" };
  // @ts-expect-error 失敗の分類は sent / transient / permanent / unknown だけ
  const wrongKind: ChannelSendResult = { address: "a", kind: "retry", reason: "x" };
  // 宛先には配信停止のカテゴリーとヘッダを任意で渡せる
  const withStop: ChannelSendTarget = {
    userId: "u1",
    address: "a",
    messageKey: "auth.verification",
    idempotencyKey: "d1",
    content: {},
    category: "promotion",
    headers: { "List-Unsubscribe": "<https://x.test/u>" },
  };
  // @ts-expect-error ヘッダの値は文字列だけ
  const badHeaders: ChannelSendTarget = { ...withStop, headers: { a: 1 } };
  // @ts-expect-error 連絡の鍵は必須
  const noKey: ChannelSendTarget = { userId: "u1", address: "a", idempotencyKey: "d1", content: {} };
  assert.ok(withStop && badHeaders && noKey);
  // 入切は任意の真偽(既定 true)
  const off: MessageChannel = { ...channel, enabled: false };
  // @ts-expect-error 入切は真偽だけ
  const wrongEnabled: MessageChannel = { ...channel, enabled: "off" };
  assert.ok(off && wrongEnabled);
  // @ts-expect-error send は必須
  const noSend: MessageChannel = { key: "x", label: "x", addressing: "user" };
  // @ts-expect-error 送信チャンネルは自分の欄を持たない(fields は無い)
  const withFields: MessageChannel = { ...channel, fields: z.object({}) };
  assert.ok(withFields);
  assert.ok(wrongAddressing && wrongKind && noSend);
});

test("値・カテゴリー・送り元・購読", async () => {
  const enricher: MessageEnricher = {
    key: "rank",
    target: { messages: ["auth.verification"], kinds: ["promotion"] },
    provides: z.object({ rankName: z.string() }),
    aliases: { rankName: "ランク名" },
    resolve: () => ({ rankName: "ゴールド" }),
  };
  assert.deepEqual(
    await enricher.resolve({ messageKey: "auth.verification", recipient: { userId: "u1", name: null, email: null }, vars: {} }),
    { rankName: "ゴールド" },
  );

  // 当て先: 鍵・カテゴリー・種別のどれか(OR)、all = 全部(D127)
  assert.equal(enricherTargets(enricher.target, { key: "auth.verification", category: "a", kind: "functional" }), true);
  assert.equal(enricherTargets(enricher.target, { key: "x.y", category: "a", kind: "promotion" }), true);
  assert.equal(enricherTargets(enricher.target, { key: "x.y", category: "a", kind: "activity" }), false);
  assert.equal(enricherTargets({ categories: ["a"] }, { key: "x.y", category: "a", kind: "activity" }), true);
  assert.equal(enricherTargets({ all: true }, { key: "x.y", category: "b", kind: "activity" }), true);
  assert.equal(enricherTargets({}, { key: "x.y", category: "b", kind: "activity" }), false);

  const category: MessageCategory = { key: "campaign", label: "キャンペーン", kind: "promotion", channels: ["email"] };
  // 管理画面の名前は任意(無い = label、D124)
  const withAdminLabel: MessageCategory = { ...category, adminLabel: "一般的なキャンペーン" };
  assert.equal(categoryAdminLabel(withAdminLabel), "一般的なキャンペーン");
  assert.equal(categoryAdminLabel(category), "キャンペーン");
  // カテゴリーは 7 つの種別のどれでも持てる(取引のカテゴリーもある、D81)。送信チャンネルは必須
  const transactional: MessageCategory = { key: "x", label: "x", kind: "transactional", channels: ["email"] };
  // @ts-expect-error 送信チャンネルの無いカテゴリーは書けない
  const noChannels: MessageCategory = { key: "y", label: "y", kind: "activity" };
  void noChannels;

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

  // @ts-expect-error 当てる連絡の鍵は <domain>.<name>
  const badEnricher: MessageEnricher = { ...enricher, target: { messages: ["noDot"] } };
  assert.ok(category && transactional && source && badEnricher);
});

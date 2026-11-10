// provider の webhook の事件の当て方の検査(DB は偽物)
// - 事件は一度だけ(同じ provider × provider_event_id は何もしない)
// - 配達は provider の message id で引き、無ければタグの配達の id
// - 状態は前にだけ進み、時刻は最初の 1 回だけ。suppressed の行は変えない
// - bounced_hard・complained は宛先の停止(scope '*')、bounced_soft は停止しない
// - 計測の機能が閉なら opened / clicked は記録も反映もしない
// - 受け口: 知らない経路・provider 404、鍵なし 503、署名の誤り 401、当てる誤りは投げる(route が 500)
// 実行: pnpm test src/features/core/messaging/services/server/webhooks
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import type { ChannelWebhookEvent, MessageChannel } from "@/lib/messaging";

import { hashAddress } from "../sendMessage/stops";
import { applyChannelWebhookEvents, type WebhookDeliveryRow, type WebhookStore } from "./applyEvents";
import { WebhookNotConfiguredError } from "./errors";
import { handleChannelWebhookWith } from "./index";

const T = (iso: string) => new Date(iso);

function setup(tracking = false) {
  const deliveries: (WebhookDeliveryRow & { provider: string; provider_message_id: string | null })[] = [
    {
      id: "d1",
      provider: "resend",
      provider_message_id: "pm-1",
      status: "sent",
      address: "a@x.test",
      sent_at: T("2026-11-10T00:00:00Z"),
      delivered_at: null,
      failed_at: null,
      opened_at: null,
      clicked_at: null,
      complained_at: null,
    },
    {
      id: "d2",
      provider: "resend",
      provider_message_id: null,
      status: "unknown",
      address: "b@x.test",
      sent_at: null,
      delivered_at: null,
      failed_at: null,
      opened_at: null,
      clicked_at: null,
      complained_at: null,
    },
    {
      id: "d3",
      provider: "resend",
      provider_message_id: "pm-3",
      status: "suppressed",
      address: "c@x.test",
      sent_at: null,
      delivered_at: null,
      failed_at: null,
      opened_at: null,
      clicked_at: null,
      complained_at: null,
    },
  ];
  const events: { provider: string; providerEventId: string; deliveryId: string | null; type: string }[] = [];
  const suppressions: { channel: string; addressHash: string; reason: string }[] = [];
  const store: WebhookStore = {
    async findDelivery({ provider, providerMessageId, deliveryId }) {
      return (
        deliveries.find((d) => providerMessageId && d.provider === provider && d.provider_message_id === providerMessageId) ??
        deliveries.find((d) => deliveryId && d.id === deliveryId) ??
        null
      );
    },
    async insertEvent(values) {
      if (events.some((e) => e.provider === values.provider && e.providerEventId === values.providerEventId)) return false;
      events.push(values);
      return true;
    },
    async updateDelivery(id, patch) {
      Object.assign(deliveries.find((d) => d.id === id)!, patch);
    },
    async addSuppression(values) {
      suppressions.push(values);
    },
  };
  const deps = { store, trackingEnabled: () => tracking, now: () => T("2026-11-11T00:00:00Z") };
  const apply = (list: Partial<ChannelWebhookEvent>[]) =>
    applyChannelWebhookEvents(
      deps,
      "email",
      list.map((e, i) => ({
        provider: "resend",
        providerMessageId: null,
        providerEventId: `ev-${i}`,
        type: "other",
        address: null,
        occurredAt: T("2026-11-10T01:00:00Z"),
        raw: {},
        ...e,
      })),
    );
  const d = (id: string) => deliveries.find((row) => row.id === id)!;
  return { apply, d, events, suppressions };
}

test("事件は一度だけ。配達は provider の id で、無ければタグの配達の id で引く", async () => {
  const { apply, d, events } = setup();
  const first = await apply([
    { providerEventId: "e1", providerMessageId: "pm-1", type: "delivered" },
    { providerEventId: "e2", deliveryId: "d2", type: "delivered" },
    { providerEventId: "e3", providerMessageId: "nope", type: "delivered" },
  ]);
  assert.deepEqual(first, { stored: 3, duplicates: 0, skippedTracking: 0, unmatched: 1 });
  assert.equal(d("d1").status, "delivered");
  assert.equal(d("d2").status, "delivered");
  assert.deepEqual(events.map((e) => e.deliveryId), ["d1", "d2", null]);
  const again = await apply([{ providerEventId: "e1", providerMessageId: "pm-1", type: "delivered" }]);
  assert.equal(again.duplicates, 1);
  assert.equal(events.length, 3);
});

test("状態は前にだけ進み、時刻は最初の 1 回だけ。suppressed の行は変えない", async () => {
  const { apply, d } = setup();
  await apply([{ providerEventId: "e1", providerMessageId: "pm-1", type: "delivered", occurredAt: T("2026-11-10T02:00:00Z") }]);
  // 遅れて届いた古い sent は戻さない
  await apply([{ providerEventId: "e2", providerMessageId: "pm-1", type: "sent", occurredAt: T("2026-11-10T00:30:00Z") }]);
  assert.equal(d("d1").status, "delivered");
  assert.equal(d("d1").sent_at?.toISOString(), "2026-11-10T00:00:00.000Z");
  await apply([{ providerEventId: "e3", providerMessageId: "pm-1", type: "delivered", occurredAt: T("2026-11-10T05:00:00Z") }]);
  assert.equal(d("d1").delivered_at?.toISOString(), "2026-11-10T02:00:00.000Z");
  // 届いた後の非同期の bounce は bounced へ進む
  await apply([{ providerEventId: "e4", providerMessageId: "pm-1", type: "bounced_soft" }]);
  assert.equal(d("d1").status, "bounced");
  await apply([{ providerEventId: "e5", providerMessageId: "pm-1", type: "delivered" }]);
  assert.equal(d("d1").status, "bounced");
  await apply([{ providerEventId: "e6", providerMessageId: "pm-3", type: "delivered" }]);
  assert.equal(d("d3").status, "suppressed");
  assert.ok(d("d3").delivered_at);
});

test("hard の bounce と苦情は宛先の停止、soft は停止しない。dropped は failed", async () => {
  const { apply, d, suppressions } = setup();
  await apply([
    { providerEventId: "e1", providerMessageId: "pm-1", type: "bounced_soft" },
    { providerEventId: "e2", deliveryId: "d2", type: "bounced_hard", address: "B@X.test" },
    { providerEventId: "e3", providerMessageId: "pm-1", type: "complained" },
  ]);
  assert.deepEqual(suppressions.map((s) => [s.reason, s.addressHash]), [
    ["hard_bounce", hashAddress("b@x.test")],
    ["complaint", hashAddress("a@x.test")],
  ]);
  assert.ok(d("d1").complained_at);
  const dropped = setup();
  await dropped.apply([{ providerEventId: "e1", deliveryId: "d2", type: "dropped" }]);
  assert.equal(dropped.d("d2").status, "failed");
});

test("計測の機能が閉なら開封・クリックは記録も反映もしない、開なら最初の時刻を残す", async () => {
  const closed = setup(false);
  const result = await closed.apply([
    { providerEventId: "e1", providerMessageId: "pm-1", type: "opened" },
    { providerEventId: "e2", providerMessageId: "pm-1", type: "clicked" },
  ]);
  assert.deepEqual(result, { stored: 0, duplicates: 0, skippedTracking: 2, unmatched: 0 });
  assert.equal(closed.events.length, 0);
  assert.equal(closed.d("d1").opened_at, null);
  const open = setup(true);
  await open.apply([{ providerEventId: "e1", providerMessageId: "pm-1", type: "opened" }]);
  assert.ok(open.d("d1").opened_at);
  assert.equal(open.d("d1").status, "sent");
});

test("受け口: 知らない経路・provider 404、鍵なし 503、署名の誤り 401、当てる誤りは投げる", async () => {
  const channel = (verify: () => unknown): MessageChannel => ({
    key: "email",
    label: "メール",
    addressing: "user",
    fields: z.object({}),
    send: async () => [],
    webhooks: { resend: { verify, normalize: () => [] } },
  });
  const run = (channels: Record<string, MessageChannel>, apply = async () => ({ stored: 0, duplicates: 0, skippedTracking: 0, unmatched: 0 })) =>
    handleChannelWebhookWith(
      { channels, apply },
      { channel: "email", provider: "resend", rawBody: "{}", headers: new Headers() },
    );
  assert.equal((await run({})).status, 404);
  assert.equal(
    (await handleChannelWebhookWith(
      { channels: { email: channel(() => ({})) }, apply: async () => ({ stored: 0, duplicates: 0, skippedTracking: 0, unmatched: 0 }) },
      { channel: "email", provider: "sendgrid", rawBody: "{}", headers: new Headers() },
    )).status,
    404,
  );
  assert.equal((await run({ email: channel(() => { throw new WebhookNotConfiguredError("resend"); }) })).status, 503);
  assert.equal((await run({ email: channel(() => { throw new Error("bad signature"); }) })).status, 401);
  assert.equal((await run({ email: channel(() => ({})) })).status, 200);
  await assert.rejects(run({ email: channel(() => ({})) }, async () => { throw new Error("db down"); }), /db down/);
});

// 連絡の日まとめのメトリクスの検査(偽物の store)
// - 鍵 messaging.<measure>・flow・dims {channel, messageKey, category}、0 の dims は書かない
// - 1 日分の読み込みは同じ日の指標で共有(4 つの問い合わせが 1 回ずつ)
// - enabled は項目が渡す門をそのまま使う(受け口の項目の検査は featureGate のテスト)。lookbackDays は 3(既定)/ 7 / 14 / 30
// 実行: pnpm test src/features/core/analytics
import { test } from "node:test";
import assert from "node:assert/strict";

import { createMessagingRollupFactory, MESSAGING_ROLLUP_MEASURES, type MessagingRollupMeasure } from "./rollup";
import type { MessagingAnalyticsStore, MessagingQueryScope } from "./types";

const group = (messageKey: string | null, category: string | null) => JSON.stringify([messageKey, category]);

function fakeStore() {
  const calls: string[] = [];
  const scopes: MessagingQueryScope[] = [];
  const store: MessagingAnalyticsStore = {
    async dispatchCounts(scope) {
      calls.push("dispatch");
      scopes.push(scope);
      return [
        { period: "cur", group: group("shop.notice", "news"), channel: "email", targeted: 5, sent: 4, failed: 1, skippedNoAddress: 0, suppressed: 0, skippedThrottled: 0 },
        { period: "cur", group: group("shop.notice", "news"), channel: "inApp", targeted: 5, sent: 5, failed: 0, skippedNoAddress: 0, suppressed: 0, skippedThrottled: 0 },
      ];
    },
    async deliveryCounts() {
      calls.push("delivery");
      return [{ period: "cur", group: group("shop.notice", "news"), channel: "email", delivered: 3, bounced: 1, complained: 0, opened: 2, clicked: 1 }];
    },
    async readCounts() {
      calls.push("read");
      return [{ period: "cur", group: group("shop.notice", "news"), read: 2 }];
    },
    async unsubscribeCounts() {
      calls.push("unsubscribe");
      return [
        { period: "cur", group: group(null, "news"), channel: "email", count: 1 },
        { period: "cur", group: group("shop.notice", "news"), channel: "email", count: 2 },
      ];
    },
    async dispatchPage() {
      return [];
    },
    async templateNames() {
      return new Map();
    },
  };
  return { store, calls, scopes };
}

const day = {
  dateKey: "2026-11-11",
  dateFrom: new Date("2026-11-10T15:00:00.000Z"),
  dateTo: new Date("2026-11-11T14:59:59.999Z"),
  timezone: "Asia/Tokyo",
};

function setup() {
  const fake = fakeStore();
  const factory = createMessagingRollupFactory({ store: fake.store, now: () => 0 });
  const metric = (measure: MessagingRollupMeasure, enabled: () => boolean = () => true) => factory(measure, { enabled });
  return { ...fake, metric };
}

test("鍵・dims・値(0 の dims は書かない)、配信停止の結び付き無しは messageKey null", async () => {
  const { metric, scopes } = setup();
  assert.deepEqual(await metric("sent").compute(day), [
    { value: 4, dims: { channel: "email", messageKey: "shop.notice", category: "news" } },
    { value: 5, dims: { channel: "inApp", messageKey: "shop.notice", category: "news" } },
  ]);
  assert.deepEqual(await metric("complained").compute(day), []);
  assert.deepEqual(await metric("read").compute(day), [{ value: 2, dims: { channel: "inApp", messageKey: "shop.notice", category: "news" } }]);
  assert.deepEqual(
    (await metric("unsubscribed").compute(day)).map((entry) => [entry.dims?.messageKey, entry.value]),
    [
      [null, 1],
      ["shop.notice", 2],
    ],
  );
  assert.equal(metric("sent").key, "messaging.sent");
  assert.equal(metric("sent").kind, "flow");
  assert.equal(scopes[0].groupBy, "rollup");
  assert.deepEqual(scopes[0].current, { from: day.dateFrom, to: day.dateTo });
});

test("同じ日の 11 指標で読み込みは 1 回(4 つの問い合わせが 1 回ずつ)", async () => {
  const { metric, calls } = setup();
  for (const measure of MESSAGING_ROLLUP_MEASURES) await metric(measure).compute(day);
  assert.deepEqual(calls.sort(), ["delivery", "dispatch", "read", "unsubscribe"]);
});

test("enabled は項目が渡す門、lookbackDays は 3(既定)/ 7 / 14 / 30", () => {
  const { metric } = setup();
  assert.equal(metric("sent", () => false).enabled!(), false);
  assert.equal(metric("sent", () => true).enabled!(), true);
  assert.deepEqual(
    MESSAGING_ROLLUP_MEASURES.map((measure) => [measure, metric(measure).lookbackDays ?? null]),
    [
      ["targeted", null],
      ["sent", null],
      ["failed", null],
      ["suppressed", null],
      ["delivered", 7],
      ["bounced", 7],
      ["complained", 7],
      ["opened", 14],
      ["clicked", 14],
      ["read", 30],
      ["unsubscribed", null],
    ],
  );
});

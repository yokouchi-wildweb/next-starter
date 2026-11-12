// 連絡の集計(messagingAnalytics)の検査。SQL の部分は偽物の store、送りの組の SQL の形は PgDialect で組み立てて確かめる。
// - summary: 経路を足した数・同じ組の率・前の期間と変化率、開封・クリックは計測が閉なら null(0 と区別)
// - 配達の行が保持の日数を過ぎた範囲は delivered〜clicked が null(detailRetained false)
// - series は空のバケットも 0 で埋める。breakdown: 経路の軸は行の経路、結び付きの無い配信停止は key null、テンプレートの見出し、知らない軸は 400
// - dispatches: 回の管理が閉なら空、回ごとの数、cursor
// - 送りの組の SQL: is_test・予約 / 取り消しを外し、legacy.notification は既読(withLegacy)の時だけ入る、Date を値に入れない
// 実行: pnpm test src/features/core/analytics
import { test } from "node:test";
import assert from "node:assert/strict";

import { PgDialect } from "drizzle-orm/pg-core";

import { DomainError } from "@/lib/errors";

import { createMessagingAnalytics, decodeDispatchCursor, encodeDispatchCursor } from "./service";
import { dispatchWhere, LEGACY_NOTIFICATION_SOURCE } from "./store";
import type { MessagingAnalyticsStore, MessagingQueryScope } from "./types";

const NOW = new Date("2026-11-12T12:00:00.000Z");
const RANGE = { dateFrom: "2026-11-05", dateTo: "2026-11-11", timezone: "UTC" };
const D1 = "11111111-1111-4111-8111-111111111111";
const D2 = "22222222-2222-4222-8222-222222222222";

function fakeStore(overrides: Partial<MessagingAnalyticsStore> = {}): MessagingAnalyticsStore & { scopes: MessagingQueryScope[] } {
  const scopes: MessagingQueryScope[] = [];
  return {
    scopes,
    async dispatchCounts(scope) {
      scopes.push(scope);
      return [
        { period: "cur", group: null, channel: "email", targeted: 10, sent: 8, failed: 2, skippedNoAddress: 0, suppressed: 1, skippedThrottled: 0 },
        { period: "cur", group: null, channel: "inApp", targeted: 10, sent: 10, failed: 0, skippedNoAddress: 0, suppressed: 0, skippedThrottled: 3 },
        { period: "prev", group: null, channel: "email", targeted: 5, sent: 4, failed: 1, skippedNoAddress: 0, suppressed: 0, skippedThrottled: 0 },
      ];
    },
    async deliveryCounts() {
      return [{ period: "cur", group: null, channel: "email", delivered: 6, bounced: 1, complained: 1, opened: 4, clicked: 2 }];
    },
    async readCounts() {
      return [{ period: "cur", group: null, read: 5 }];
    },
    async unsubscribeCounts() {
      return [
        { period: "cur", group: null, channel: "email", count: 2 },
        { period: "prev", group: null, channel: "email", count: 1 },
      ];
    },
    async dispatchPage() {
      return [];
    },
    async templateNames(ids) {
      return new Map(ids.map((id) => [id, `テンプレート ${id}`]));
    },
    ...overrides,
  };
}

function setup(options: { tracking?: boolean; dispatches?: boolean; store?: MessagingAnalyticsStore } = {}) {
  const store = options.store ?? fakeStore();
  const analytics = createMessagingAnalytics({
    store,
    gateEnabled: (feature) => (feature === "messagingTracking" ? (options.tracking ?? true) : (options.dispatches ?? true)),
    now: () => NOW,
    deliveriesDays: 90,
  });
  return { store, analytics };
}

test("summary: 経路を足した数、同じ組の率、前の期間と変化率", async () => {
  const store = fakeStore();
  const { analytics } = setup({ store });
  const result = await analytics.getSummary(RANGE);
  const m = result.metrics;
  assert.equal(m.targeted, 20);
  assert.equal(m.sent, 18);
  assert.equal(m.inAppSent, 10);
  assert.equal(m.read, 5);
  assert.equal(m.delivered, 6);
  assert.equal(m.unsubscribed, 2);
  assert.equal(m.rates.deliveredRate, 6 / 18);
  assert.equal(m.rates.openRate, 4 / 18);
  assert.equal(m.rates.unsubscribeRate, 2 / 18);
  assert.equal(m.rates.failedRate, 2 / 20);
  assert.equal(m.rates.readRate, 5 / 10);
  assert.equal(m.skippedThrottled, 3);
  assert.equal(result.comparison.previous.sent, 4);
  assert.equal(result.comparison.previous.delivered, 0);
  assert.equal(result.comparison.changeRate.sent, (18 - 4) / 4);
  assert.equal(result.comparison.changeRate.unsubscribed, 1);
  assert.equal(result.trackingEnabled, true);
  assert.equal(m.detailRetained, true);
  // 前の期間は同じ長さの直前
  assert.ok(store.scopes[0].previous);
  assert.equal(store.scopes[0].groupBy, "none");
});

test("計測が閉なら開封・クリックは null(率も null)、他は数える", async () => {
  const { analytics } = setup({ tracking: false });
  const result = await analytics.getSummary(RANGE);
  assert.equal(result.metrics.opened, null);
  assert.equal(result.metrics.clicked, null);
  assert.equal(result.metrics.rates.openRate, null);
  assert.equal(result.metrics.delivered, 6);
  assert.equal(result.comparison.changeRate.opened, null);
  assert.equal(result.trackingEnabled, false);
});

test("配達の行が保持の日数を過ぎた範囲は delivered〜clicked が null(detailRetained false)", async () => {
  const { analytics } = setup();
  const result = await analytics.getSummary({ dateFrom: "2026-07-01", dateTo: "2026-07-07", timezone: "UTC" });
  assert.equal(result.metrics.detailRetained, false);
  assert.equal(result.metrics.delivered, null);
  assert.equal(result.metrics.bounced, null);
  assert.equal(result.metrics.rates.deliveredRate, null);
  // 回の数・既読・配信停止は残る
  assert.equal(result.metrics.sent, 18);
  assert.equal(result.metrics.read, 5);
});

test("series: 粒度のバケットを全部返し、データの無いバケットは 0", async () => {
  const store = fakeStore({
    async dispatchCounts(scope) {
      assert.equal(scope.groupBy, "date");
      assert.equal(scope.previous, undefined);
      return [{ period: "cur", group: "2026-11-06", channel: "email", targeted: 3, sent: 3, failed: 0, skippedNoAddress: 0, suppressed: 0, skippedThrottled: 0 }];
    },
    async deliveryCounts() {
      return [];
    },
    async readCounts() {
      return [];
    },
    async unsubscribeCounts() {
      return [{ period: "cur", group: "2026-11-08", channel: "email", count: 1 }];
    },
  });
  const { analytics } = setup({ store });
  const result = await analytics.getSeries(RANGE);
  assert.equal(result.history.length, 7);
  assert.equal(result.history[0].date, "2026-11-05");
  assert.equal(result.history[1].sent, 3);
  assert.equal(result.history[3].unsubscribed, 1);
  assert.equal(result.history[0].sent, 0);
  assert.ok(result.history.every((day) => day.detailRetained));
});

test("breakdown: 経路の軸は行の経路、結び付きの無い配信停止は key null、テンプレートは見出し、知らない軸は 400", async () => {
  const channel = await setup().analytics.getBreakdown({ ...RANGE, axis: "channel" });
  assert.deepEqual(channel.entries.map((entry) => entry.key), ["inApp", "email"]);
  const email = channel.entries.find((entry) => entry.key === "email")!;
  assert.equal(email.metrics.unsubscribed, 2);
  assert.equal(email.comparison.previous.sent, 4);
  assert.equal(channel.entries.find((entry) => entry.key === "inApp")!.metrics.read, 5);

  const linked = fakeStore({
    async dispatchCounts() {
      return [{ period: "cur", group: "shop.notice", channel: "email", targeted: 4, sent: 4, failed: 0, skippedNoAddress: 0, suppressed: 0, skippedThrottled: 0 }];
    },
    async deliveryCounts() {
      return [];
    },
    async readCounts() {
      return [];
    },
    async unsubscribeCounts() {
      return [
        { period: "cur", group: "shop.notice", channel: "email", count: 1 },
        { period: "cur", group: null, channel: "email", count: 3 },
      ];
    },
  });
  const message = await setup({ store: linked }).analytics.getBreakdown({ ...RANGE, axis: "message" });
  assert.deepEqual(
    message.entries.map((entry) => [entry.key, entry.metrics.unsubscribed]),
    [
      ["shop.notice", 1],
      [null, 3],
    ],
  );

  const template = await setup({ store: linked }).analytics.getBreakdown({ ...RANGE, axis: "template" });
  assert.equal(template.entries[0].label, "テンプレート shop.notice");
  assert.equal(template.entries[1].label, null);

  await assert.rejects(
    setup().analytics.getBreakdown({ ...RANGE, axis: "day" }),
    (error: unknown) => error instanceof DomainError && error.status === 400,
  );
});

test("dispatches: 回の管理が閉なら空、開なら回ごとの数と cursor", async () => {
  const closed = await setup({ dispatches: false }).analytics.getDispatches(RANGE);
  assert.deepEqual(closed.items, []);
  assert.equal(closed.dispatchesEnabled, false);

  const pages: unknown[] = [];
  const store = fakeStore({
    async dispatchPage(params) {
      pages.push(params);
      return [
        { id: D1, messageKey: "shop.notice", category: "news", kind: "marketing", templateId: null, tags: ["sale"], anchor: new Date("2026-11-10T00:00:00Z"), status: "completed", retractedAt: null },
        { id: D2, messageKey: "shop.notice", category: "news", kind: "marketing", templateId: null, tags: null, anchor: new Date("2026-11-09T00:00:00Z"), status: "completed", retractedAt: new Date("2026-11-10T00:00:00Z") },
      ];
    },
    async dispatchCounts(scope) {
      assert.equal(scope.groupBy, "dispatch");
      assert.deepEqual(scope.dispatchIds, [D1]);
      return [{ period: "cur", group: D1, channel: "email", targeted: 2, sent: 2, failed: 0, skippedNoAddress: 0, suppressed: 0, skippedThrottled: 0 }];
    },
    async deliveryCounts() {
      return [{ period: "cur", group: D1, channel: "email", delivered: 1, bounced: 0, complained: 0, opened: 1, clicked: 0 }];
    },
    async readCounts() {
      return [];
    },
    async unsubscribeCounts() {
      return [];
    },
  });
  const result = await setup({ store }).analytics.getDispatches({ ...RANGE, limit: 1 });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].metrics.sent, 2);
  assert.equal(result.items[0].metrics.opened, 1);
  assert.deepEqual(result.items[0].tags, ["sale"]);
  assert.equal((pages[0] as { limit: number }).limit, 2);
  assert.ok(result.nextCursor);
  assert.deepEqual(decodeDispatchCursor(result.nextCursor!), { anchor: new Date("2026-11-10T00:00:00Z"), id: D1 });
  assert.throws(() => decodeDispatchCursor("broken"), DomainError);
  assert.equal(encodeDispatchCursor(new Date("2026-11-10T00:00:00Z"), D1), result.nextCursor);
});

test("送りの組の SQL: is_test・予約 / 取り消しを外し、legacy.notification は既読の時だけ、Date を値に入れない", () => {
  const dialect = new PgDialect();
  const scope: MessagingQueryScope = {
    current: { from: new Date("2026-11-05T00:00:00Z"), to: new Date("2026-11-11T23:59:59Z") },
    previous: { from: new Date("2026-10-29T00:00:00Z"), to: new Date("2026-11-04T23:59:59Z") },
    groupBy: "none",
    granularity: "day",
    timezone: "UTC",
    filter: { messageKey: "shop.notice" },
  };
  const sends = dialect.sqlToQuery(dispatchWhere(scope, { withLegacy: false }));
  assert.match(sends.sql, /"is_test" = false/);
  assert.match(sends.sql, /NOT IN \('scheduled', 'cancelled'\)/);
  assert.ok(sends.params.includes(LEGACY_NOTIFICATION_SOURCE));
  assert.ok(sends.params.includes("shop.notice"));
  assert.ok(sends.params.includes("2026-10-29T00:00:00.000Z"), "前の期間の始まりから");
  assert.ok(!sends.params.some((value) => value instanceof Date));
  const reads = dialect.sqlToQuery(dispatchWhere(scope, { withLegacy: true }));
  assert.ok(!reads.params.includes(LEGACY_NOTIFICATION_SOURCE));
});

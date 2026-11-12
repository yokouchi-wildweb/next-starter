// src/features/core/analytics/services/server/messagingAnalytics/store.db.test.ts
// 連絡の集計の SQL の実 DB テスト(読むだけ)。全部の分け方(期間・日・軸・回)で開発 DB に問い合わせ、SQL が通って行の形が合うことを確かめる。
// DATABASE_URL が無ければ全件 skip。列が無ければ失敗する(先に pnpm db:push。配信停止の出どころの列は指令 32 の push)。
// 実行: pnpm test --db src/features/core/analytics/services/server/messagingAnalytics/store.db.test.ts

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

type Store = typeof import("./store").drizzleMessagingAnalyticsStore;
type Scope = import("./types").MessagingQueryScope;

let store: Store;

const DAY_MS = 24 * 60 * 60 * 1000;
const to = new Date();
const from = new Date(to.getTime() - 30 * DAY_MS);
const previous = { from: new Date(from.getTime() - 30 * DAY_MS), to: new Date(from.getTime() - 1) };
const GROUPS: Scope["groupBy"][] = ["none", "date", "channel", "message", "category", "template", "tag"];

describe("messagingAnalytics の SQL(実 DB、読むだけ)", { skip }, () => {
  before(async () => {
    ({ drizzleMessagingAnalyticsStore: store } = await import("./store"));
  });

  after(async () => {
    const { db } = await import("@/lib/drizzle");
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  for (const groupBy of GROUPS) {
    test(`分け方 ${groupBy}: 回・配達・既読の問い合わせが通り、期間の印が cur / prev`, async () => {
      const scope: Scope = { current: { from, to }, previous, groupBy, granularity: "day", timezone: "Asia/Tokyo", filter: {} };
      const rows = await Promise.all([store.dispatchCounts(scope), store.deliveryCounts(scope), store.readCounts(scope)]);
      for (const row of rows.flat()) assert.ok(row.period === "cur" || row.period === "prev");
    });

    // 配信停止の出どころの列(source_message_key / source_dispatch_id)は push の後
    test(`分け方 ${groupBy}: 配信停止の問い合わせが通る`, async () => {
      const scope: Scope = { current: { from, to }, previous, groupBy, granularity: "day", timezone: "Asia/Tokyo", filter: {} };
      for (const row of await store.unsubscribeCounts(scope)) assert.ok(row.period === "cur" || row.period === "prev");
    });
  }

  test("絞りつき・回ごと・回の頁・テンプレートの名前", async () => {
    const filter = { channel: "email", messageKey: "shop.notice", category: "news" };
    const scope: Scope = { current: { from, to }, groupBy: "none", granularity: "week", timezone: "UTC", filter };
    await Promise.all([store.dispatchCounts(scope), store.deliveryCounts(scope), store.readCounts(scope)]);
    const page = await store.dispatchPage({ from, to, filter: {}, cursor: null, limit: 5 });
    const ids = page.map((row) => row.id);
    const byDispatch: Scope = { current: { from, to }, groupBy: "dispatch", granularity: "day", timezone: "UTC", filter: {}, dispatchIds: ids };
    await Promise.all([store.dispatchCounts(byDispatch), store.deliveryCounts(byDispatch), store.readCounts(byDispatch)]);
    if (page.length > 0) {
      const last = page[page.length - 1];
      const next = await store.dispatchPage({ from, to, filter: {}, cursor: { anchor: last.anchor, id: last.id }, limit: 5 });
      assert.ok(next.every((row) => row.anchor <= last.anchor));
    }
    assert.ok((await store.templateNames([])) instanceof Map);
  });
});

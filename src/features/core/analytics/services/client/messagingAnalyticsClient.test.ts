// 連絡の集計の HTTP クライアントの検査(axios の adapter を偽物に)。
// - 口の path、期間と絞りを query に渡す(undefined・null・空文字は落とす)、breakdown は axis を足す、dispatches は cursor・limit
// - 失敗は normalizeHttpError で HttpError に(メッセージが無ければ口ごとの既定の文)
// 実行: pnpm test src/features/core/analytics/services/client/messagingAnalyticsClient.test.ts
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import axios, { type AxiosAdapter } from "axios";

import { HttpError } from "@/lib/errors";

import * as client from "./messagingAnalyticsClient";

const calls: { url: string; params: Record<string, unknown> }[] = [];
let failWith: unknown = null;
// 通信の代わり(axios の adapter を差し替える)
const fakeAdapter: AxiosAdapter = async (config) => {
  calls.push({ url: config.url ?? "", params: config.params as Record<string, unknown> });
  if (failWith !== null) throw failWith;
  return { data: { url: config.url }, status: 200, statusText: "OK", headers: {}, config };
};
axios.defaults.adapter = fakeAdapter;

beforeEach(() => {
  calls.length = 0;
  failWith = null;
});

test("summary・series: 期間と絞りを query に渡し、無い値は落とす", async () => {
  await client.fetchMessagingSummary({
    days: 7,
    granularity: "day",
    channel: "email",
    messageKey: undefined,
    category: "",
  });
  await client.fetchMessagingSeries({ dateFrom: "2026-11-01", dateTo: "2026-11-07", alignToGranularity: true });
  assert.deepEqual(calls, [
    { url: "/api/admin/analytics/messaging/summary", params: { days: 7, granularity: "day", channel: "email" } },
    {
      url: "/api/admin/analytics/messaging/series",
      params: { dateFrom: "2026-11-01", dateTo: "2026-11-07", alignToGranularity: true },
    },
  ]);
});

test("breakdown: axis を query に足す", async () => {
  await client.fetchMessagingBreakdown("template", { category: "marketing" });
  assert.deepEqual(calls, [
    { url: "/api/admin/analytics/messaging/breakdown", params: { category: "marketing", axis: "template" } },
  ]);
});

test("dispatches: cursor・limit を渡し、cursor null は落とす", async () => {
  await client.fetchMessagingDispatches({ days: 30, cursor: null, limit: 20 });
  await client.fetchMessagingDispatches({ cursor: "cur-1", limit: 20 });
  assert.deepEqual(
    calls.map((c) => c.params),
    [
      { days: 30, limit: 20 },
      { cursor: "cur-1", limit: 20 },
    ],
  );
  assert.equal(calls[0].url, "/api/admin/analytics/messaging/dispatches");
});

test("失敗は HttpError(メッセージが無ければ口ごとの既定の文)", async () => {
  failWith = "boom";
  await assert.rejects(client.fetchMessagingSummary(), (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.message, "連絡の集計の取得に失敗しました");
    return true;
  });
  await assert.rejects(client.fetchMessagingBreakdown("channel"), /連絡の集計の内訳の取得に失敗しました/);
});

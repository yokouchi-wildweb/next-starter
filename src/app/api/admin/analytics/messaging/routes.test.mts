// src/app/api/admin/analytics/messaging/routes.test.mts
// /api/admin/analytics/messaging/{summary, series, breakdown, dispatches} の検査(Factory・集計の service は偽物)。
// - 宣言: 4 つの口が access { roleCategories: ["admin"] }(住所は規則 messagingAnalytics が proxy で閉じる)
// - 期間・絞り・axis・cursor / limit をそのまま service へ渡す、service の 400 をそのまま返す
// 実行: pnpm test src/app/api/admin/analytics/messaging/routes.test.mts

import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { NextRequest, NextResponse } from "next/server";

const { DomainError } = await import("@/lib/errors");
const { parseMessagingFilterParams } = await import("@/features/core/analytics/services/server/messagingAnalytics/params");

const declared: { operation: string; access: unknown }[] = [];
type Handler = (req: NextRequest) => Promise<unknown>;
const createApiRoute = (options: { operation: string; access: unknown }, handler: Handler) => {
  declared.push({ operation: options.operation, access: options.access });
  return async (req: NextRequest) => {
    try {
      return NextResponse.json(await handler(req));
    } catch (error) {
      if (error instanceof DomainError) return NextResponse.json({ message: error.message }, { status: error.status });
      throw error;
    }
  };
};
mock.module("@/wiring/apiRoute", { namedExports: { createApiRoute } });

const calls: unknown[][] = [];
const record = (name: string) => async (params: { axis?: string }) => {
  calls.push([name, params]);
  if (name === "breakdown" && params.axis === "nope") throw new DomainError("axis が違います", { status: 400 });
  return { ok: name };
};
mock.module("@/features/core/analytics/services/server/messagingAnalytics", {
  namedExports: {
    getMessagingSummary: record("summary"),
    getMessagingSeries: record("series"),
    getMessagingBreakdown: record("breakdown"),
    getMessagingDispatches: record("dispatches"),
    parseMessagingFilterParams,
  },
});

const summary = await import("./summary/route.ts");
const series = await import("./series/route.ts");
const breakdown = await import("./breakdown/route.ts");
const dispatches = await import("./dispatches/route.ts");

const BASE = "http://localhost/api/admin/analytics/messaging";
const get = (path: string) => new NextRequest(`${BASE}/${path}`);

beforeEach(() => {
  calls.length = 0;
});

test("4 つの口は管理者だけ", () => {
  assert.deepEqual(
    declared.map((entry) => entry.operation).sort(),
    ["breakdown", "dispatches", "series", "summary"].map((view) => `GET /api/admin/analytics/messaging/${view}`),
  );
  for (const entry of declared) assert.deepEqual(entry.access, { roleCategories: ["admin"] });
});

test("期間と絞りを service へ渡す", async () => {
  const response = await summary.GET(get("summary?days=7&channel=email&messageKey=shop.notice&category=news&excluded=1"));
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0], ["summary", { days: 7, channel: "email", messageKey: "shop.notice", category: "news" }]);
  await series.GET(get("series?dateFrom=2026-11-01&dateTo=2026-11-07&granularity=week"));
  assert.deepEqual(calls[1], ["series", { dateFrom: "2026-11-01", dateTo: "2026-11-07", granularity: "week" }]);
});

test("breakdown は axis を渡し、service の 400 を返す", async () => {
  await breakdown.GET(get("breakdown?axis=tag"));
  assert.deepEqual(calls[0], ["breakdown", { axis: "tag" }]);
  const bad = await breakdown.GET(get("breakdown?axis=nope"));
  assert.equal(bad.status, 400);
  await breakdown.GET(get("breakdown"));
  assert.deepEqual(calls[2], ["breakdown", { axis: "" }]);
});

test("dispatches は cursor と数の limit を渡す(数でない limit は渡さない)", async () => {
  await dispatches.GET(get("dispatches?cursor=abc&limit=50"));
  assert.deepEqual(calls[0], ["dispatches", { cursor: "abc", limit: 50 }]);
  await dispatches.GET(get("dispatches?limit=x"));
  assert.deepEqual(calls[1], ["dispatches", {}]);
});

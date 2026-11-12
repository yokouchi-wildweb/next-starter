// src/features/core/analytics/services/server/messagingAnalytics/service.ts
// 連絡(messaging)の集計(D14・D19・D37)。summary・日ごとの series・軸ごとの breakdown・回ごとの dispatches。
// 部品(store・門・今・配達の保持の日数)を受けて作る(テストは偽物を渡す、本物は index.ts)。
//
// 門(関数が測る物の開閉を自分で確かめる): 開封・クリックは messagingTracking が閉なら null、
// 回ごとのビューは messagingDispatches が閉なら空。住所は規則 messagingAnalytics が閉じる。

import { DomainError } from "@/lib/errors";

import type { ResolvedDateRange } from "@/features/core/analytics/types/common";
import { derivePreviousRange, formatDateKeyTz, formatDateRangeForResponse, generateDateKeys, resolveDateRange } from "../utils/dateRange";
import { bucketize, compare, emptyCounts, toMetrics, type SourceRows } from "./assemble";
import {
  MESSAGING_BREAKDOWN_AXES,
  type MessagingAnalyticsParams,
  type MessagingAnalyticsStore,
  type MessagingBreakdownAxis,
  type MessagingBreakdownResponse,
  type MessagingDispatchesResponse,
  type MessagingQueryScope,
  type MessagingSeriesResponse,
  type MessagingSummaryResponse,
} from "./types";

export type MessagingAnalyticsDeps = {
  store: MessagingAnalyticsStore;
  gateEnabled: (feature: "messagingTracking" | "messagingDispatches") => boolean;
  now: () => Date;
  /** 配達の行の保持の日数(messagingConfig.retention.deliveriesDays) */
  deliveriesDays: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DISPATCH_LIMIT_DEFAULT = 20;
const DISPATCH_LIMIT_MAX = 100;

function filterOf(params: MessagingAnalyticsParams) {
  return {
    ...(params.channel ? { channel: params.channel } : {}),
    ...(params.messageKey ? { messageKey: params.messageKey } : {}),
    ...(params.category ? { category: params.category } : {}),
  };
}

async function loadRows(store: MessagingAnalyticsStore, scope: MessagingQueryScope): Promise<SourceRows> {
  const [dispatch, delivery, read, unsubscribe] = await Promise.all([
    store.dispatchCounts(scope),
    store.deliveryCounts(scope),
    store.readCounts(scope),
    store.unsubscribeCounts(scope),
  ]);
  return { dispatch, delivery, read, unsubscribe };
}

/** 回ごとのビューの cursor(送った時刻 ISO | id の base64url) */
export function encodeDispatchCursor(anchor: Date, id: string): string {
  return Buffer.from(`${anchor.toISOString()}|${id}`, "utf8").toString("base64url");
}

/** @throws DomainError(400) 形の誤り */
export function decodeDispatchCursor(cursor: string): { anchor: Date; id: string } {
  const [at, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const anchor = new Date(at ?? "");
  if (!id || Number.isNaN(anchor.getTime()) || !/^[0-9a-f-]{36}$/.test(id)) {
    throw new DomainError("cursor が正しくありません", { status: 400 });
  }
  return { anchor, id };
}

export function createMessagingAnalytics(deps: MessagingAnalyticsDeps) {
  const trackingEnabled = () => deps.gateEnabled("messagingTracking");
  /** この時刻より前に送った回の配達の行は保持の掃除で消えている(かもしれない) */
  const retainedFrom = () => new Date(deps.now().getTime() - deps.deliveriesDays * DAY_MS);

  function scopeOf(range: ResolvedDateRange, params: MessagingAnalyticsParams, groupBy: MessagingQueryScope["groupBy"], withPrevious: boolean): MessagingQueryScope {
    const previous = withPrevious ? derivePreviousRange(range) : undefined;
    return {
      current: { from: range.dateFrom, to: range.dateTo },
      ...(previous ? { previous: { from: previous.dateFrom, to: previous.dateTo } } : {}),
      groupBy,
      granularity: range.granularity,
      timezone: range.timezone,
      filter: filterOf(params),
    };
  }

  return {
    /** 期間の合計 + 前の期間と変化率 */
    async getSummary(params: MessagingAnalyticsParams): Promise<MessagingSummaryResponse> {
      const range = resolveDateRange(params);
      const scope = scopeOf(range, params, "none", true);
      const bucket = bucketize(await loadRows(deps.store, scope), { byChannel: false }).get(null);
      const tracking = trackingEnabled();
      const cutoff = retainedFrom();
      const metrics = toMetrics(bucket?.cur ?? emptyCounts(), { trackingEnabled: tracking, detailRetained: range.dateFrom >= cutoff });
      const previous = toMetrics(bucket?.prev ?? emptyCounts(), {
        trackingEnabled: tracking,
        detailRetained: scope.previous!.from >= cutoff,
      });
      return { ...formatDateRangeForResponse(range), metrics, comparison: compare(metrics, previous), trackingEnabled: tracking };
    },

    /** 粒度のバケットごと(データの無いバケットも 0 で埋める。前の期間は無い) */
    async getSeries(params: MessagingAnalyticsParams): Promise<MessagingSeriesResponse> {
      const range = resolveDateRange(params);
      const buckets = bucketize(await loadRows(deps.store, scopeOf(range, params, "date", false)), { byChannel: false });
      const tracking = trackingEnabled();
      // 保持の境目のバケットは一部が消えているので、境目より後のバケットだけ retained
      const cutoffKey = formatDateKeyTz(retainedFrom(), range.timezone, range.granularity);
      const history = generateDateKeys(range).map((date) => ({
        date,
        ...toMetrics(buckets.get(date)?.cur ?? emptyCounts(), { trackingEnabled: tracking, detailRetained: date > cutoffKey }),
      }));
      return { ...formatDateRangeForResponse(range), history, trackingEnabled: tracking };
    },

    /**
     * 軸ごとの内訳(当期 + 前の期間と変化率)。配信停止の結び付きの無い行・テンプレートで無い回・タグの無い回は key null
     * @throws DomainError(400) 知らない軸
     */
    async getBreakdown(params: MessagingAnalyticsParams & { axis: string }): Promise<MessagingBreakdownResponse> {
      if (!(MESSAGING_BREAKDOWN_AXES as readonly string[]).includes(params.axis)) {
        throw new DomainError(`axis は ${MESSAGING_BREAKDOWN_AXES.join(" / ")} のどれか`, { status: 400 });
      }
      const axis = params.axis as MessagingBreakdownAxis;
      const range = resolveDateRange(params);
      const scope = scopeOf(range, params, axis, true);
      const buckets = bucketize(await loadRows(deps.store, scope), { byChannel: axis === "channel" });
      const tracking = trackingEnabled();
      const cutoff = retainedFrom();
      const names =
        axis === "template"
          ? await deps.store.templateNames([...buckets.keys()].filter((key): key is string => key !== null))
          : new Map<string, string>();
      const entries = [...buckets].map(([key, bucket]) => {
        const metrics = toMetrics(bucket.cur, { trackingEnabled: tracking, detailRetained: range.dateFrom >= cutoff });
        const previous = toMetrics(bucket.prev, { trackingEnabled: tracking, detailRetained: scope.previous!.from >= cutoff });
        return { key, label: key === null ? null : (names.get(key) ?? key), metrics, comparison: compare(metrics, previous) };
      });
      // 送った数の多い順(同じなら key の順、null は最後)
      entries.sort((a, b) => b.metrics.sent - a.metrics.sent || (a.key === null ? 1 : b.key === null ? -1 : a.key.localeCompare(b.key)));
      return { ...formatDateRangeForResponse(range), axis, entries, trackingEnabled: tracking };
    },

    /**
     * 回ごと(送った時刻の新しい順、cursor で続き)。回の管理が閉なら空
     * @throws DomainError(400) cursor の形の誤り
     */
    async getDispatches(params: MessagingAnalyticsParams & { cursor?: string; limit?: number }): Promise<MessagingDispatchesResponse> {
      const range = resolveDateRange(params);
      const tracking = trackingEnabled();
      const base = { ...formatDateRangeForResponse(range), trackingEnabled: tracking };
      if (!deps.gateEnabled("messagingDispatches")) {
        return { ...base, items: [], nextCursor: null, dispatchesEnabled: false };
      }
      const limit = Math.min(Math.max(Math.trunc(params.limit ?? DISPATCH_LIMIT_DEFAULT), 1), DISPATCH_LIMIT_MAX);
      const page = await deps.store.dispatchPage({
        from: range.dateFrom,
        to: range.dateTo,
        filter: filterOf(params),
        cursor: params.cursor ? decodeDispatchCursor(params.cursor) : null,
        limit: limit + 1,
      });
      const rows = page.slice(0, limit);
      const scope: MessagingQueryScope = {
        ...scopeOf(range, params, "dispatch", false),
        dispatchIds: rows.map((row) => row.id),
      };
      const buckets = rows.length > 0 ? bucketize(await loadRows(deps.store, scope), { byChannel: false }) : new Map();
      const cutoff = retainedFrom();
      const items = rows.map((row) => ({
        dispatchId: row.id,
        messageKey: row.messageKey,
        category: row.category,
        kind: row.kind,
        templateId: row.templateId,
        tags: row.tags ?? [],
        sentAt: row.anchor.toISOString(),
        status: row.status,
        retracted: row.retractedAt !== null,
        metrics: toMetrics(buckets.get(row.id)?.cur ?? emptyCounts(), {
          trackingEnabled: tracking,
          detailRetained: row.anchor >= cutoff,
        }),
      }));
      const last = rows.at(-1);
      return {
        ...base,
        items,
        nextCursor: page.length > limit && last ? encodeDispatchCursor(last.anchor, last.id) : null,
        dispatchesEnabled: true,
      };
    },
  };
}

export type MessagingAnalytics = ReturnType<typeof createMessagingAnalytics>;

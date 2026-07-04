// src/features/core/analytics/services/server/rollup/readSeries.ts
// 日次ロールアップの読み取りパス。
//
// 確定済みの過去日はロールアップ行（PK ルックアップ）から読み、
// 当日の部分バケットのみ compute をライブ実行してマージする。
// これによりダッシュボードの時系列がソーステーブルのフルスキャン無しで返せる。
//
// kind による意味論の分岐:
//  - flow:     欠損日 = 0、週/月バケット = 日の合計
//  - snapshot: 欠損日 = 直前値のキャリーフォワード、週/月バケット = バケット末日の値。
//              範囲開始前の直近行 1 件をベースラインとして先読みするため、
//              ランニングバランスでも全履歴スキャンは発生しない。

import { and, desc, eq, gte, lt, lte, type SQL } from "drizzle-orm";
import { AnalyticsDailyRollupTable } from "@/features/core/analytics/entities/drizzle";
import type { Granularity, ResolvedDateRange } from "@/features/core/analytics/types/common";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";
import {
  assertGranularitySupported,
  formatDateKeyTz,
  formatDateRangeForResponse,
  generateDateKeys,
  resolveDayBounds,
} from "../utils/dateRange";
import {
  canonicalizeDims,
  computeRollupValues,
  getRollupMetricConfig,
  rollupTimezone,
} from "./rollupService";
import type { RolledDailySeriesResponse, RollupMetricValue } from "./types";

const t = AnalyticsDailyRollupTable;

/** ロールアップ読み取りがサポートする粒度（日次行が最小単位のため hour 不可） */
export const ROLLUP_SUPPORTED_GRANULARITIES = ["day", "week", "month"] as const satisfies readonly Granularity[];

export type ReadRolledDailySeriesOptions = {
  metricKey: string;
  range: ResolvedDateRange;
  /**
   * ディメンションで絞り込む（canonicalizeDims による完全一致）。
   * 省略時はディメンション横断で日ごとに合算する。
   * 「ディメンション無しの行のみ」を指したい場合は {} を渡す。
   */
  dims?: Record<string, unknown>;
  /**
   * 範囲に当日が含まれる場合に compute をライブ実行してマージするか（既定 true）。
   * false の場合、当日は flow=0 / snapshot=前日値キャリーとして扱われる。
   */
  includeLive?: boolean;
};

/**
 * ロールアップ済み日次系列を読み取る。
 *
 * 制約:
 *  - range.timezone はメトリクスのタイムゾーンと一致していること
 *    （バケット境界が異なる行を混ぜられないため）
 *  - granularity は day / week / month（hour は GranularityNotSupportedError）
 */
export async function readRolledDailySeries(
  options: ReadRolledDailySeriesOptions,
): Promise<RolledDailySeriesResponse> {
  const { range } = options;
  const config = getRollupMetricConfig(options.metricKey);
  const tz = rollupTimezone(config);

  assertGranularitySupported(
    range.granularity,
    ROLLUP_SUPPORTED_GRANULARITIES,
    `ロールアップ "${config.key}" の読み取り`,
  );
  if (range.timezone !== tz) {
    throw new DomainError(
      `ロールアップ "${config.key}" は timezone=${tz} で集計されています。異なる timezone (${range.timezone}) の読み取りはバケット境界が一致しないため未対応です。`,
      { status: 400 },
    );
  }

  const dayKeys = generateDateKeys({ ...range, granularity: "day" });
  const firstKey = dayKeys[0];
  const lastKey = dayKeys[dayKeys.length - 1];
  if (!firstKey || !lastKey) {
    return { ...responseBase(range), history: [], includesLiveBucket: false };
  }

  const dimsCondition =
    options.dims !== undefined ? eq(t.dimsKey, canonicalizeDims(options.dims)) : undefined;

  // 範囲内のロールアップ行を日ごとに合算（当日行は書き込まれないため自然に確定日のみ）
  const dayValues = await readDayValues(config.key, firstKey, lastKey, dimsCondition);

  // 当日の部分バケットをライブ計算でマージ
  const todayKey = formatDateKeyTz(new Date(), tz);
  const includeLive = options.includeLive ?? true;
  const includesLiveBucket = includeLive && todayKey >= firstKey && todayKey <= lastKey;
  if (includesLiveBucket) {
    const liveValues = await computeRollupValues(config, todayKey);
    dayValues.set(todayKey, sumValues(liveValues, options.dims));
  }

  // snapshot: 範囲開始前の直近行をベースラインに（1 行ルックアップ、全履歴スキャン不要）
  let carry = 0;
  if (config.kind === "snapshot") {
    carry = (await readSnapshotBaseline(config.key, firstKey, dimsCondition)) ?? 0;
  }

  // 日次値を確定しつつ granularity バケットへ集約する
  const history: { date: string; value: number }[] = [];
  let bucketKey: string | null = null;
  let bucketValue = 0;
  for (const dayKey of dayKeys) {
    let value: number;
    if (config.kind === "snapshot") {
      value = dayValues.get(dayKey) ?? carry;
      carry = value;
    } else {
      value = dayValues.get(dayKey) ?? 0;
    }

    const key =
      range.granularity === "day"
        ? dayKey
        : formatDateKeyTz(resolveDayBounds(dayKey, tz).dateFrom, tz, range.granularity);
    if (key !== bucketKey) {
      if (bucketKey !== null) history.push({ date: bucketKey, value: bucketValue });
      bucketKey = key;
      bucketValue = 0;
    }
    // flow はバケット内合計、snapshot はバケット末日の値
    bucketValue = config.kind === "flow" ? bucketValue + value : value;
  }
  if (bucketKey !== null) history.push({ date: bucketKey, value: bucketValue });

  return { ...responseBase(range), history, includesLiveBucket };
}

// ============================================================================
// 内部実装
// ============================================================================

function responseBase(range: ResolvedDateRange): Omit<RolledDailySeriesResponse, "history" | "includesLiveBucket"> {
  const base = formatDateRangeForResponse(range);
  return {
    dateFrom: base.dateFrom,
    dateTo: base.dateTo,
    granularity: base.granularity as RolledDailySeriesResponse["granularity"],
  };
}

/** 範囲内のロールアップ行を読み、日付キー → 合算値の Map を返す */
async function readDayValues(
  metricKey: string,
  firstKey: string,
  lastKey: string,
  dimsCondition: SQL | undefined,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ bucketDate: t.bucketDate, value: t.value })
    .from(t)
    .where(
      and(
        eq(t.metricKey, metricKey),
        gte(t.bucketDate, firstKey),
        lte(t.bucketDate, lastKey),
        dimsCondition,
      ),
    );

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.bucketDate, (map.get(row.bucketDate) ?? 0) + Number(row.value));
  }
  return map;
}

/** 範囲開始前の直近ロールアップ日の合算値（snapshot のベースライン） */
async function readSnapshotBaseline(
  metricKey: string,
  firstKey: string,
  dimsCondition: SQL | undefined,
): Promise<number | undefined> {
  const latest = await db
    .select({ bucketDate: t.bucketDate })
    .from(t)
    .where(and(eq(t.metricKey, metricKey), lt(t.bucketDate, firstKey), dimsCondition))
    .orderBy(desc(t.bucketDate))
    .limit(1);
  const baselineDate = latest[0]?.bucketDate;
  if (!baselineDate) return undefined;

  const rows = await db
    .select({ value: t.value })
    .from(t)
    .where(and(eq(t.metricKey, metricKey), eq(t.bucketDate, baselineDate), dimsCondition));
  return rows.reduce((total, row) => total + Number(row.value), 0);
}

/** compute のライブ結果を dims 指定に従って合算する */
function sumValues(values: RollupMetricValue[], dims?: Record<string, unknown>): number {
  const filter = dims !== undefined ? canonicalizeDims(dims) : undefined;
  let total = 0;
  for (const entry of values) {
    if (filter !== undefined && canonicalizeDims(entry.dims) !== filter) continue;
    total += Number.isFinite(entry.value) ? entry.value : 0;
  }
  return total;
}

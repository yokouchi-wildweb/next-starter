// src/features/core/analytics/services/server/rollup/rollupService.ts
// 日次ロールアップの書き込みパス（計算 + 冪等 upsert・日次 cron・バックフィル）。
//
// 設計方針:
//  - ロールアップ行は常に「ソーステーブルから再計算可能な派生キャッシュ」。
//    書き込みは日単位の delete → insert（同一 tx）で行い、何度実行しても
//    同じソース状態からは同じ結果になる（冪等）。消えたディメンションの
//    残骸行も残らない。
//  - 対象日は常に「確定済みの過去日」。当日の部分バケットは書き込まず、
//    読み取り側（readSeries）がライブ計算でマージする。
//  - 日付は文字列キー（YYYY-MM-DD）で扱い、date 型カラムへは文字列のまま
//    バインドする（JS Date を sql に渡さない）。

import { and, eq } from "drizzle-orm";
import { AnalyticsDailyRollupTable } from "@/features/core/analytics/entities/drizzle";
import { DEFAULT_TIMEZONE } from "@/features/core/analytics/constants";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";
import { analyticsRollupMetrics } from "@/registry/analyticsRollupRegistry";
import { invalidateAnalyticsCache } from "../utils/analyticsCache";
import { formatDateKeyTz, resolveDayBounds } from "../utils/dateRange";
import type {
  RollupDayContext,
  RollupMetricConfig,
  RollupMetricValue,
  RollupRunMetricResult,
} from "./types";

const t = AnalyticsDailyRollupTable;

/** 日次 cron が自己修復のために遡って再計算する日数（当日除く・昨日を含む） */
const DEFAULT_ROLLUP_LOOKBACK_DAYS = 3;

// ============================================================================
// レジストリアクセス
// ============================================================================

/**
 * 登録済みメトリクス設定を key で引く。未登録・key 重複は設定ミスとして即エラー。
 */
export function getRollupMetricConfig(metricKey: string): RollupMetricConfig {
  const config = buildRegistryMap().get(metricKey);
  if (!config) {
    const known = [...buildRegistryMap().keys()].join(", ") || "(なし)";
    throw new DomainError(
      `ロールアップメトリクス "${metricKey}" は未登録です。登録済み: ${known}`,
      { status: 400 },
    );
  }
  return config;
}

/** 登録済みメトリクス設定の一覧（key 重複検証込み） */
export function listRollupMetricConfigs(): RollupMetricConfig[] {
  return [...buildRegistryMap().values()];
}

function buildRegistryMap(): Map<string, RollupMetricConfig> {
  const map = new Map<string, RollupMetricConfig>();
  for (const config of analyticsRollupMetrics) {
    if (map.has(config.key)) {
      throw new DomainError(
        `analyticsRollupRegistry に key "${config.key}" が重複登録されています。`,
        { status: 500 },
      );
    }
    map.set(config.key, config);
  }
  return map;
}

/** メトリクスに適用するタイムゾーン */
export function rollupTimezone(config: RollupMetricConfig): string {
  return config.timezone ?? DEFAULT_TIMEZONE;
}

// ============================================================================
// ディメンション正規化
// ============================================================================

/**
 * dims を正規化キー文字列に変換する（トップレベルキーの昇順ソート + JSON化）。
 * dims 無し（undefined / 空オブジェクト）は "" に正規化される。
 */
export function canonicalizeDims(dims?: Record<string, unknown>): string {
  if (!dims) return "";
  const keys = Object.keys(dims).sort();
  if (keys.length === 0) return "";
  const sorted: Record<string, unknown> = {};
  for (const key of keys) {
    sorted[key] = dims[key];
  }
  return JSON.stringify(sorted);
}

// ============================================================================
// 1日分の計算 + 冪等 upsert
// ============================================================================

/**
 * 指定メトリクスの指定日を計算する（書き込み無し）。
 *
 * 前日のロールアップ済み行を previous としてコンテキストに載せて compute を呼ぶ。
 * 当日の部分バケットをライブ計算する読み取りパス（readSeries）もこれを使う。
 */
export async function computeRollupValues(
  config: RollupMetricConfig,
  dateKey: string,
): Promise<RollupMetricValue[]> {
  const tz = rollupTimezone(config);
  const day = buildDayContext(config, dateKey, tz, await readPreviousDayValues(config, dateKey));
  return config.compute(day);
}

/**
 * 指定メトリクスの指定日を計算してロールアップ行を書き込む。
 *
 * 同一 tx で delete → insert するため、再実行してもソース状態に対して冪等。
 * 遡及的なデータ修正（集計除外の適用等）後の再計算パスもこの関数（経由のバックフィル）。
 *
 * @returns 書き込んだ行数
 */
export async function computeRollupForDate(
  config: RollupMetricConfig,
  dateKey: string,
): Promise<number> {
  const values = await computeRollupValues(config, dateKey);
  const rows = normalizeComputedValues(config, dateKey, values);

  await db.transaction(async (tx) => {
    await tx
      .delete(t)
      .where(and(eq(t.metricKey, config.key), eq(t.bucketDate, dateKey)));
    if (rows.length > 0) {
      await tx.insert(t).values(rows);
    }
  });

  return rows.length;
}

/** compute の戻り値を検証して insert 行へ変換する */
function normalizeComputedValues(
  config: RollupMetricConfig,
  dateKey: string,
  values: RollupMetricValue[],
): (typeof t.$inferInsert)[] {
  const seen = new Set<string>();
  return values.map((entry) => {
    if (!Number.isFinite(entry.value)) {
      throw new DomainError(
        `ロールアップ "${config.key}" (${dateKey}) の compute が有限でない値を返しました。`,
        { status: 500 },
      );
    }
    const dimsKey = canonicalizeDims(entry.dims);
    if (seen.has(dimsKey)) {
      throw new DomainError(
        `ロールアップ "${config.key}" (${dateKey}) の compute がディメンション "${dimsKey || "(なし)"}" を重複して返しました。compute 側で集約してください。`,
        { status: 500 },
      );
    }
    seen.add(dimsKey);
    return {
      metricKey: config.key,
      bucketDate: dateKey,
      dimsKey,
      dims: entry.dims ?? null,
      value: String(entry.value),
    };
  });
}

/** 前日のロールアップ済み行を読む（無ければ undefined） */
async function readPreviousDayValues(
  config: RollupMetricConfig,
  dateKey: string,
): Promise<RollupMetricValue[] | undefined> {
  const prevKey = shiftDateKey(dateKey, -1);
  const rows = await db
    .select({ dims: t.dims, value: t.value })
    .from(t)
    .where(and(eq(t.metricKey, config.key), eq(t.bucketDate, prevKey)));
  if (rows.length === 0) return undefined;
  return rows.map((row) => ({
    value: Number(row.value),
    dims: (row.dims as Record<string, unknown> | null) ?? undefined,
  }));
}

function buildDayContext(
  config: RollupMetricConfig,
  dateKey: string,
  tz: string,
  previous: RollupMetricValue[] | undefined,
): RollupDayContext {
  const bounds = resolveDayBounds(dateKey, tz);
  return { dateKey, dateFrom: bounds.dateFrom, dateTo: bounds.dateTo, timezone: tz, previous };
}

// ============================================================================
// 日次 cron
// ============================================================================

export type RunDailyRollupOptions = {
  /**
   * 昨日から遡って再計算する日数（既定 3）。
   * 冪等なので毎回直近N日を無条件に再計算し、遅延到着データと
   * cron の実行漏れ（ギャップ）を同時に自己修復する。
   */
  lookbackDays?: number;
  /** 対象メトリクスを絞る（省略時は登録済み全メトリクス） */
  metricKeys?: string[];
};

/**
 * 登録済み全メトリクスの「昨日〜昨日-(lookbackDays-1)」を再計算する日次タスク。
 *
 * メトリクス単位で独立に実行し、一部の失敗が他メトリクスを止めない。
 * 1つでも失敗があれば全メトリクス処理後にエラーを投げる（監視でアラート可能にするため）。
 */
export async function runDailyRollup(
  options: RunDailyRollupOptions = {},
): Promise<{ metrics: RollupRunMetricResult[] }> {
  const lookbackDays = options.lookbackDays ?? DEFAULT_ROLLUP_LOOKBACK_DAYS;
  if (!Number.isInteger(lookbackDays) || lookbackDays <= 0) {
    throw new DomainError("lookbackDays は正の整数で指定してください。", { status: 400 });
  }

  const configs = options.metricKeys
    ? options.metricKeys.map(getRollupMetricConfig)
    : listRollupMetricConfigs();

  const metrics: RollupRunMetricResult[] = [];
  const errors: string[] = [];

  for (const config of configs) {
    const days = dailyTargetDays(config, lookbackDays);
    try {
      let rows = 0;
      // snapshot の previous 参照が正しく連鎖するよう必ず古い日から順に計算する
      for (const dateKey of days) {
        rows += await computeRollupForDate(config, dateKey);
      }
      metrics.push({ metricKey: config.key, days, rows });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${config.key}: ${message}`);
    }
  }

  // 確定済みバケットの値が変わった可能性があるため、同一インスタンスのキャッシュを破棄
  invalidateAnalyticsCache();

  if (errors.length > 0) {
    throw new Error(
      `ロールアップ日次実行で ${errors.length} 件のメトリクスが失敗（成功: ${metrics.map((m) => m.metricKey).join(", ") || "なし"}）: ${errors.join(" / ")}`,
    );
  }

  return { metrics };
}

/** 昨日から lookbackDays 日分（古い順）。backfillFrom より前へは遡らない */
function dailyTargetDays(config: RollupMetricConfig, lookbackDays: number): string[] {
  const tz = rollupTimezone(config);
  const yesterday = shiftDateKey(formatDateKeyTz(new Date(), tz), -1);
  const days: string[] = [];
  for (let i = lookbackDays - 1; i >= 0; i--) {
    const dateKey = shiftDateKey(yesterday, -i);
    if (config.backfillFrom && dateKey < config.backfillFrom) continue;
    days.push(dateKey);
  }
  return days;
}

// ============================================================================
// バックフィル
// ============================================================================

export type BackfillRollupOptions = {
  metricKey: string;
  /** 開始日（YYYY-MM-DD）。省略時は config.backfillFrom */
  from?: string;
  /** 終了日（YYYY-MM-DD）。省略時は昨日 */
  to?: string;
};

/**
 * 指定メトリクスを期間分まとめて（再）計算する。
 *
 * 用途:
 *  - メトリクス新規登録時の過去データ埋め
 *  - 集計除外の遡及適用・ソースデータ修正後の再計算
 *
 * 古い日から順に処理するため、snapshot メトリクスは previous（前日値）を
 * 利用した増分計算が可能。
 */
export async function backfillRollup(
  options: BackfillRollupOptions,
): Promise<{ metricKey: string; from: string; to: string; days: number; rows: number }> {
  const config = getRollupMetricConfig(options.metricKey);
  const tz = rollupTimezone(config);

  const from = options.from ?? config.backfillFrom;
  if (!from) {
    throw new DomainError(
      `ロールアップ "${config.key}" は backfillFrom 未設定のため、開始日（from）の指定が必須です。`,
      { status: 400 },
    );
  }
  const yesterday = shiftDateKey(formatDateKeyTz(new Date(), tz), -1);
  const to = options.to ?? yesterday;

  assertDateKey(from, "from");
  assertDateKey(to, "to");
  if (from > to) {
    throw new DomainError(`期間が不正です（from=${from} > to=${to}）。`, { status: 400 });
  }
  if (to > yesterday) {
    throw new DomainError(
      `to は昨日（${yesterday}）以前を指定してください。当日は読み取り時にライブ計算されます。`,
      { status: 400 },
    );
  }

  let days = 0;
  let rows = 0;
  for (let dateKey = from; dateKey <= to; dateKey = shiftDateKey(dateKey, 1)) {
    rows += await computeRollupForDate(config, dateKey);
    days++;
  }

  invalidateAnalyticsCache();

  return { metricKey: config.key, from, to, days, rows };
}

// ============================================================================
// 日付キーユーティリティ
// ============================================================================

/**
 * YYYY-MM-DD キーを days 日ずらす。
 * キーは既にローカル日付として確定しているため UTC 演算で足りる（TZ 非依存）。
 */
export function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function assertDateKey(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DomainError(`${label} は YYYY-MM-DD 形式で指定してください: "${value}"`, {
      status: 400,
    });
  }
}

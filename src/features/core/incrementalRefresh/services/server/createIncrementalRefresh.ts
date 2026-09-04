// src/features/core/incrementalRefresh/services/server/createIncrementalRefresh.ts
// read-model（スナップショット）テーブルを、ソーステーブルの更新から差分で最新化する
// 時間予算付き cron タスクのファクトリ。
//
// 合成する部品:
//   - @/lib/cron runBudgetedBatches  … 締切をチャンク境界で判定する再開可能ループ
//   - cronCheckpoint                 … 「ここまで処理済み」の単調ウォータマーク
//
// 2 フェーズ:
//   1. dirty 走査: sources の updated_at > (checkpoint − margin) を UNION ALL で集め、
//      id ごとの MAX(updated_at) 昇順に keyset ページングしながら recompute。
//      チャンクごとに checkpoint を min(チャンク最大 updated_at, 実行開始時刻) へ前進。
//      → 途中で kill されても次回は続きから。実行開始後の更新は次回に回る（取りこぼし無し）。
//   2. trickle: 残り予算で read-model を orderByColumn（computed_at 等）の最古から少しずつ
//      再計算。dirty 走査が構造的に拾えない変化（非 HTTP 経路・updated_at が動かない集計元）
//      をゆっくり自己修復する安全網。
//
// 注意: JS Date を sql テンプレートに直接埋めない（ISO 文字列 + ::timestamptz）。

import { sql, type SQL } from "drizzle-orm";

import { createDeadline, runBudgetedBatches } from "@/lib/cron";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";

import { advanceCheckpoint, getCheckpoint } from "@/features/core/cronCheckpoint/services/server";

import type {
  IncrementalRefreshConfig,
  IncrementalRefreshResult,
  IncrementalRefreshRunner,
  RefreshSource,
  RunIncrementalRefreshOptions,
  TrickleSweepConfig,
} from "../../types";

const DEFAULT_OVERLAP_MARGIN_MS = 120_000;
const DEFAULT_DIRTY_CHUNK_SIZE = 200;
const DEFAULT_TRICKLE_BATCH_SIZE = 100;
const DEFAULT_TRICKLE_MAX_PER_RUN = 1000;

/**
 * dirty_at は driver がミリ秒精度の Date に丸めるため、keyset カーソル用に
 * `::text` の生値（マイクロ秒精度）も併せて取る。丸めた値でカーソルを作ると
 * 同一行が次ページに再登場する（重複 recompute）。
 */
type DirtyRow = { id: string; dirty_at: string | Date; dirty_at_raw: string };
type DirtyCursor = {
  /** Postgres の text 表現そのまま（精度を落とさず `::timestamptz` で往復する） */
  atRaw: string;
  /** ミリ秒精度（チェックポイント計算用。切り捨て側なので保守的） */
  at: Date;
  id: string;
};

function assertPositiveInt(value: number | undefined, label: string): void {
  if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
    throw new DomainError(`${label} は正の整数で指定してください: ${value}`, { status: 400 });
  }
}

function validateConfig(config: IncrementalRefreshConfig): void {
  if (!config.name || config.name.trim().length === 0) {
    throw new DomainError("createIncrementalRefresh: name は必須です。", { status: 400 });
  }
  if (!Array.isArray(config.sources) || config.sources.length === 0) {
    throw new DomainError(
      `createIncrementalRefresh(${config.name}): sources は 1 つ以上指定してください。`,
      { status: 400 },
    );
  }
  // 存在しないカラム参照（例: snake_case プロパティを camelCase で参照）は undefined になり、
  // SQL 生成時に空文字として埋め込まれて分かりにくい構文エラーになるため、生成時に弾く。
  config.sources.forEach((source, index) => {
    for (const key of ["table", "idColumn", "updatedAtColumn"] as const) {
      if (!source[key]) {
        throw new DomainError(
          `createIncrementalRefresh(${config.name}): sources[${index}].${key} が未定義です（entities の property 名を確認してください）。`,
          { status: 400 },
        );
      }
    }
  });
  if (config.trickle) {
    for (const key of ["table", "idColumn", "orderByColumn"] as const) {
      if (!config.trickle[key]) {
        throw new DomainError(
          `createIncrementalRefresh(${config.name}): trickle.${key} が未定義です（entities の property 名を確認してください）。`,
          { status: 400 },
        );
      }
    }
  }
  if (typeof config.recompute !== "function") {
    throw new DomainError(`createIncrementalRefresh(${config.name}): recompute は必須です。`, {
      status: 400,
    });
  }
  if (
    config.overlapMarginMs !== undefined &&
    (!Number.isFinite(config.overlapMarginMs) || config.overlapMarginMs < 0)
  ) {
    throw new DomainError(
      `createIncrementalRefresh(${config.name}): overlapMarginMs は 0 以上で指定してください。`,
      { status: 400 },
    );
  }
  assertPositiveInt(config.dirtyChunkSize, `createIncrementalRefresh(${config.name}): dirtyChunkSize`);
  assertPositiveInt(config.dirtyLimitPerRun, `createIncrementalRefresh(${config.name}): dirtyLimitPerRun`);
  if (config.trickle) {
    assertPositiveInt(config.trickle.batchSize, `createIncrementalRefresh(${config.name}): trickle.batchSize`);
    assertPositiveInt(config.trickle.maxPerRun, `createIncrementalRefresh(${config.name}): trickle.maxPerRun`);
  }
}

function toDate(value: string | Date): Date {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new DomainError(`updated_at の値を Date に変換できません: ${String(value)}`, { status: 500 });
  }
  return d;
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

/**
 * 1 ソース分の SELECT（UNION ALL の 1 枝）。
 * 初回ページは `updated_at > since`、2 ページ目以降は `updated_at >= cursor.at`
 * （同時刻タイは HAVING の keyset 条件で切る）。
 */
function buildSourceBranch(source: RefreshSource, since: string, inclusive: boolean): SQL {
  const cmp = inclusive
    ? sql`${source.updatedAtColumn} >= ${since}::timestamptz`
    : sql`${source.updatedAtColumn} > ${since}::timestamptz`;
  const extra = source.where ? sql` AND (${source.where})` : sql``;
  return sql`SELECT ${source.idColumn}::text AS id, ${source.updatedAtColumn} AS updated_at FROM ${source.table} WHERE ${cmp}${extra}`;
}

/**
 * dirty な id を MAX(updated_at) 昇順・id 昇順で 1 ページ取得する。
 *
 * ページング: 2 ページ目以降は各枝の下限を cursor.at に引き上げつつ（既に処理済みの
 * 古い行を UNION に含めない）、HAVING の行比較 `(MAX(updated_at), id) > (cursor.at, cursor.id)`
 * で同時刻タイと重複を除く。id の MAX が cursor 以前なら既に処理済み（順序保証）なので落ちる。
 */
async function fetchDirtyPage(
  sources: RefreshSource[],
  since: Date,
  cursor: DirtyCursor | undefined,
  limit: number,
): Promise<DirtyRow[]> {
  const lowerBound = cursor ? cursor.atRaw : since.toISOString();
  const branches = sources.map((s) => buildSourceBranch(s, lowerBound, cursor !== undefined));
  const union = sql.join(branches, sql` UNION ALL `);
  const having = cursor
    ? sql` HAVING (MAX(d.updated_at), d.id) > (${cursor.atRaw}::timestamptz, ${cursor.id}::text)`
    : sql``;
  const query = sql`
    SELECT d.id AS id, MAX(d.updated_at) AS dirty_at, MAX(d.updated_at)::text AS dirty_at_raw
    FROM (${union}) AS d
    GROUP BY d.id${having}
    ORDER BY dirty_at ASC, id ASC
    LIMIT ${limit}
  `;
  const rows = (await db.execute(query)) as unknown as DirtyRow[];
  return Array.from(rows);
}

/** trickle: orderByColumn の最古（NULL 優先）から batchSize 件の id を取る */
async function fetchTrickleBatch(trickle: TrickleSweepConfig, limit: number): Promise<string[]> {
  const extra = trickle.where ? sql` WHERE (${trickle.where})` : sql``;
  const query = sql`
    SELECT ${trickle.idColumn}::text AS id
    FROM ${trickle.table}${extra}
    ORDER BY ${trickle.orderByColumn} ASC NULLS FIRST, ${trickle.idColumn} ASC
    LIMIT ${limit}
  `;
  const rows = (await db.execute(query)) as unknown as Array<{ id: string }>;
  return Array.from(rows, (r) => r.id);
}

/**
 * 差分更新タスクのランナーを生成する。
 *
 * 戻り値の関数を cron ルート（createCronRoute）の handler と CLI（scripts/tasks/run.ts）から
 * 同じ引数で呼ぶ。設定の検証は生成時に行い、誤設定は起動時に露見させる。
 */
export function createIncrementalRefresh(config: IncrementalRefreshConfig): IncrementalRefreshRunner {
  validateConfig(config);

  const overlapMarginMs = config.overlapMarginMs ?? DEFAULT_OVERLAP_MARGIN_MS;
  const dirtyChunkSize = config.dirtyChunkSize ?? DEFAULT_DIRTY_CHUNK_SIZE;
  const initialCheckpoint = config.initialCheckpoint ?? new Date(0);

  return async function runIncrementalRefresh(
    options: RunIncrementalRefreshOptions,
  ): Promise<IncrementalRefreshResult> {
    const startedAt = new Date();
    const deadline = createDeadline(options.budgetMs, startedAt);

    // ------------------------------------------------------------------
    // Phase 1: dirty 走査
    // ------------------------------------------------------------------
    const previousCheckpoint = await getCheckpoint(config.name, initialCheckpoint);
    const since = new Date(previousCheckpoint.getTime() - overlapMarginMs);
    let checkpointAt = previousCheckpoint;

    const dirty = await runBudgetedBatches<DirtyRow, DirtyCursor>({
      deadline,
      maxItems: config.dirtyLimitPerRun,
      fetchNext: async (cursor) => {
        const rows = await fetchDirtyPage(config.sources, since, cursor, dirtyChunkSize);
        if (rows.length === 0) return null;
        const last = rows[rows.length - 1]!;
        return {
          items: rows,
          cursor: { atRaw: last.dirty_at_raw, at: toDate(last.dirty_at), id: last.id },
          done: rows.length < dirtyChunkSize,
        };
      },
      processChunk: async (rows) => {
        await config.recompute(rows.map((r) => r.id));
      },
      onChunkDone: async ({ cursor }) => {
        // 「cursor.at までの更新は全て処理済み」。ただし実行開始後の更新は
        // 走査に含まれた保証が無いので startedAt を上限にする。
        const result = await advanceCheckpoint(config.name, minDate(cursor.at, startedAt));
        checkpointAt = result.checkpointAt;
      },
    });

    if (dirty.exhausted) {
      // since 以降の更新を全て処理した = 実行開始時点までは確定。
      const result = await advanceCheckpoint(config.name, startedAt);
      checkpointAt = result.checkpointAt;
    }

    // ------------------------------------------------------------------
    // Phase 2: trickle（残り予算）
    // ------------------------------------------------------------------
    let trickleProcessed = 0;
    let trickleStopReason: IncrementalRefreshResult["trickleStopReason"] = "skipped";

    if (config.trickle && !options.skipTrickle) {
      const trickle = config.trickle;
      const batchSize = trickle.batchSize ?? DEFAULT_TRICKLE_BATCH_SIZE;
      const maxPerRun = trickle.maxPerRun ?? DEFAULT_TRICKLE_MAX_PER_RUN;
      const seen = new Set<string>();
      let noProgress = false;

      const result = await runBudgetedBatches<string, null>({
        deadline,
        maxItems: maxPerRun,
        fetchNext: async () => {
          const ids = await fetchTrickleBatch(trickle, batchSize);
          // recompute が orderByColumn を更新しない場合、同じ行が選ばれ続ける。
          // 既に処理した id ばかりなら無進捗として打ち切る（無限ループ防止）。
          const fresh = ids.filter((id) => !seen.has(id));
          if (fresh.length === 0) {
            noProgress = ids.length > 0;
            return null;
          }
          for (const id of fresh) seen.add(id);
          return { items: fresh, cursor: null, done: ids.length < batchSize };
        },
        processChunk: async (ids) => {
          await config.recompute(ids);
        },
      });

      trickleProcessed = result.processed;
      trickleStopReason = noProgress
        ? "noProgress"
        : result.stopReason === "maxItems"
          ? "maxPerRun"
          : result.stopReason === "deadline"
            ? "deadline"
            : "exhausted";

      if (noProgress) {
        console.warn(
          JSON.stringify({
            level: "warn",
            scope: "incrementalRefresh",
            task: config.name,
            message:
              "trickle が無進捗で停止しました。recompute が trickle.orderByColumn を更新しているか確認してください。",
          }),
        );
      }
    }

    return {
      dirtyProcessed: dirty.processed,
      dirtyChunks: dirty.chunks,
      dirtyExhausted: dirty.exhausted,
      trickleProcessed,
      trickleStopReason,
      checkpointAt: checkpointAt.toISOString(),
      previousCheckpointAt: previousCheckpoint.toISOString(),
      budgetExhausted: dirty.budgetExhausted || trickleStopReason === "deadline",
      durationMs: Date.now() - startedAt.getTime(),
    };
  };
}

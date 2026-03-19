// src/features/core/batchJob/services/server/batchJobService.ts

import { eq, and, sql, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { DomainError } from "@/lib/errors/domainError";
import { isPgUniqueViolation } from "@/lib/crud/drizzle/service";
import { BatchJobTable, BatchJobItemTable } from "@/features/batchJob/entities/drizzle";
import { BATCH_JOB_CONFIG } from "@/features/batchJob/constants";
import { getHandler } from "./registry";
import type {
  BatchJob,
  BatchJobStatus,
  CreateJobInput,
  ExecuteAllResult,
  JobProgress,
  ChunkResult,
} from "@/features/batchJob/types";

// --- ジョブ作成 ---

/**
 * バッチジョブを作成する。
 * batch_jobs + batch_job_items を1トランザクションで一括作成。
 */
async function createJob(input: CreateJobInput): Promise<BatchJob> {
  const {
    jobType,
    jobKey,
    params,
    itemKeys,
    batchSize = BATCH_JOB_CONFIG.defaultBatchSize,
    maxRetryCount = BATCH_JOB_CONFIG.defaultMaxRetryCount,
    targetQuery,
  } = input;

  // ハンドラ存在チェック
  getHandler(jobType);

  if (itemKeys.length === 0) {
    throw new DomainError("対象アイテムが0件です");
  }

  try {
    return await db.transaction(async (tx) => {
      const [job] = await tx
        .insert(BatchJobTable)
        .values({
          job_type: jobType,
          job_key: jobKey,
          total_count: itemKeys.length,
          batch_size: batchSize,
          max_retry_count: maxRetryCount,
          params,
          target_query: targetQuery ?? null,
        })
        .returning();

      // アイテムを5000件チャンクで一括INSERT
      const chunkSize = BATCH_JOB_CONFIG.itemsInsertChunkSize;
      for (let i = 0; i < itemKeys.length; i += chunkSize) {
        const chunk = itemKeys.slice(i, i + chunkSize);
        await tx.insert(BatchJobItemTable).values(
          chunk.map((itemKey) => ({
            job_id: job.id,
            item_key: itemKey,
          })),
        );
      }

      return mapJobRow(job);
    });
  } catch (error) {
    // #9: UNIQUE(job_type, job_key)違反をフレンドリーなエラーに変換
    if (isPgUniqueViolation(error)) {
      throw new DomainError(
        `同じジョブタイプ "${jobType}" とジョブキー "${jobKey}" の組み合わせは既に存在します`,
        { status: 409 },
      );
    }
    throw error;
  }
}

// --- チャンク実行 ---

/**
 * 1チャンク分のアイテムを処理する。
 * processChunkモード: 1トランザクション内でロック取得→処理→完了判定
 * processItemモード: アイテムごとにトランザクション分離
 */
async function executeChunk(jobId: string): Promise<{ hasMore: boolean; job: BatchJob }> {
  // ステータス事前チェック（ロックなし、早期リターン用）
  const job = await getJobRow(jobId);
  if (!job) {
    throw new DomainError("ジョブが見つかりません", { status: 404 });
  }
  if (job.status !== "pending" && job.status !== "running") {
    return { hasMore: false, job: mapJobRow(job) };
  }

  const handler = getHandler(job.job_type);

  try {
    if (typeof handler.processChunk === "function") {
      // #1修正: ロック取得→処理→完了判定を1トランザクションで実行
      return await executeChunkMode(jobId, handler);
    } else {
      return await executeItemMode(jobId, job, handler);
    }
  } catch (error) {
    // DomainError（409等）はそのまま再throw
    if (error instanceof DomainError) throw error;

    // チャンクレベル例外: 即failed
    await db
      .update(BatchJobTable)
      .set({
        status: "failed",
        error_summary: error instanceof Error ? error.message : String(error),
        updatedAt: new Date(),
      })
      .where(eq(BatchJobTable.id, jobId));

    const failedJob = await getJobRow(jobId);
    return { hasMore: false, job: mapJobRow(failedJob!) };
  }
}

// --- 一括実行 ---

/**
 * maxDurationMs まで executeChunk をループ実行する。
 * cancelled 検知で停止。
 */
async function executeAll(
  jobId: string,
  maxDurationMs: number = BATCH_JOB_CONFIG.defaultMaxDurationMs,
): Promise<ExecuteAllResult> {
  const startTime = Date.now();
  let result: { hasMore: boolean; job: BatchJob };

  do {
    result = await executeChunk(jobId);

    if (!result.hasMore) break;

    // #4修正: result.job.statusで判定（二重getJobRow不要）
    const { status } = result.job;
    if (status === "cancelled" || status === "failed" || status === "completed") {
      return { hasMore: false, job: result.job };
    }
  } while (Date.now() - startTime < maxDurationMs && result.hasMore);

  return result;
}

// --- キャンセル ---

async function cancel(jobId: string): Promise<BatchJob> {
  const job = await getJobRow(jobId);
  if (!job) {
    throw new DomainError("ジョブが見つかりません", { status: 404 });
  }

  if (job.status !== "pending" && job.status !== "running") {
    throw new DomainError(`ステータス "${job.status}" のジョブはキャンセルできません`);
  }

  const [updated] = await db
    .update(BatchJobTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(BatchJobTable.id, jobId))
    .returning();

  return mapJobRow(updated);
}

// --- 進捗取得 ---

async function getProgress(jobId: string): Promise<JobProgress> {
  const job = await getJobRow(jobId);
  if (!job) {
    throw new DomainError("ジョブが見つかりません", { status: 404 });
  }

  return {
    id: job.id,
    status: job.status as BatchJobStatus,
    totalCount: job.total_count,
    processedCount: job.processed_count,
    failedCount: job.failed_count,
    skippedCount: job.skipped_count,
    errorSummary: job.error_summary,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    createdAt: job.createdAt,
  };
}

// --- リカバリ ---

/**
 * processItemモードで processing のまま放置されたアイテムを pending に戻す。
 */
async function recoverStaleItems(jobId: string): Promise<number> {
  const job = await getJobRow(jobId);
  if (!job) {
    throw new DomainError("ジョブが見つかりません", { status: 404 });
  }

  const handler = getHandler(job.job_type);
  if (typeof handler.processItem !== "function") {
    return 0; // processChunkモードではリカバリ不要
  }

  const timeoutMs = handler.recoveryTimeoutMs ?? BATCH_JOB_CONFIG.defaultRecoveryTimeoutMs;
  const threshold = new Date(Date.now() - timeoutMs);

  const result = await db
    .update(BatchJobItemTable)
    .set({ status: "pending", updatedAt: new Date() })
    .where(
      and(
        eq(BatchJobItemTable.job_id, jobId),
        eq(BatchJobItemTable.status, "processing"),
        lt(BatchJobItemTable.updatedAt, threshold),
      ),
    )
    .returning();

  return result.length;
}

// ===========================================
// 内部ヘルパー
// ===========================================

type JobRow = typeof BatchJobTable.$inferSelect;

/**
 * #1修正: processChunkモード — ロック取得から完了判定まで1トランザクション。
 * チャンク全体が1トランザクションなので、クラッシュ時はロールバックでpendingに戻る。
 */
async function executeChunkMode(
  jobId: string,
  handler: { processChunk?: (itemKeys: string[], params: unknown, tx: TransactionClient) => Promise<ChunkResult> },
): Promise<{ hasMore: boolean; job: BatchJob }> {
  return db.transaction(async (tx) => {
    // トランザクション内で FOR UPDATE SKIP LOCKED
    const lockedJob = await acquireJobLock(tx, jobId);

    if (lockedJob.status !== "pending" && lockedJob.status !== "running") {
      return { hasMore: false, job: mapJobRow(lockedJob) };
    }

    // running遷移（初回のみ）
    if (lockedJob.status === "pending") {
      await tx
        .update(BatchJobTable)
        .set({ status: "running", started_at: new Date(), updatedAt: new Date() })
        .where(eq(BatchJobTable.id, jobId));
    }

    // pendingアイテムを取得
    const pendingItems = await tx
      .select()
      .from(BatchJobItemTable)
      .where(and(eq(BatchJobItemTable.job_id, jobId), eq(BatchJobItemTable.status, "pending")))
      .limit(lockedJob.batch_size);

    if (pendingItems.length === 0) {
      // 残りアイテムチェック → 完了判定
      return await checkAndComplete(tx, jobId);
    }

    const itemKeys = pendingItems.map((item) => item.item_key);

    // ハンドラ実行
    const result = await handler.processChunk!(itemKeys, lockedJob.params, tx);

    // アイテムステータス更新
    const now = new Date();
    if (result.succeeded.length > 0) {
      await tx
        .update(BatchJobItemTable)
        .set({ status: "completed", processed_at: now, updatedAt: now })
        .where(and(eq(BatchJobItemTable.job_id, jobId), inArray(BatchJobItemTable.item_key, result.succeeded)));
    }

    for (const f of result.failed) {
      await tx
        .update(BatchJobItemTable)
        .set({ status: "failed", error_message: f.error, processed_at: now, updatedAt: now })
        .where(and(eq(BatchJobItemTable.job_id, jobId), eq(BatchJobItemTable.item_key, f.itemKey)));
    }

    for (const s of result.skipped) {
      await tx
        .update(BatchJobItemTable)
        .set({ status: "skipped", error_message: s.reason, processed_at: now, updatedAt: now })
        .where(and(eq(BatchJobItemTable.job_id, jobId), eq(BatchJobItemTable.item_key, s.itemKey)));
    }

    // 進捗カウンタ更新
    await tx
      .update(BatchJobTable)
      .set({
        processed_count: sql`${BatchJobTable.processed_count} + ${result.succeeded.length}`,
        failed_count: sql`${BatchJobTable.failed_count} + ${result.failed.length}`,
        skipped_count: sql`${BatchJobTable.skipped_count} + ${result.skipped.length}`,
        updatedAt: now,
      })
      .where(eq(BatchJobTable.id, jobId));

    // 完了判定
    return await checkAndComplete(tx, jobId);
  });
}

/**
 * #1,#2,#3修正: processItemモード
 * - ジョブロックはアイテム単位のFOR UPDATE SKIP LOCKEDで代替
 *   （アイテムごとにtxを分ける設計のため、ジョブ行ロックを長時間保持できない）
 * - アイテム単位でpending→processing遷移（一括遷移しない）
 * - 進捗はチャンク完了後に一括更新
 */
async function executeItemMode(
  jobId: string,
  job: JobRow,
  handler: { processItem?: (itemKey: string, params: unknown, tx: TransactionClient) => Promise<void> },
): Promise<{ hasMore: boolean; job: BatchJob }> {
  // running遷移（初回のみ、アトミック）
  if (job.status === "pending") {
    await db
      .update(BatchJobTable)
      .set({ status: "running", started_at: new Date(), updatedAt: new Date() })
      .where(and(eq(BatchJobTable.id, jobId), eq(BatchJobTable.status, "pending")));
  }

  let processedCount = 0;
  let failedCount = 0;

  // アイテムを1件ずつ取得・処理
  for (let i = 0; i < job.batch_size; i++) {
    const result = await processOneItem(jobId, job.params, handler);
    if (result === null) break; // 未処理アイテムなし
    if (result === "completed") processedCount++;
    else if (result === "failed") failedCount++;
  }

  // #3修正: 進捗をチャンク完了後に一括更新
  if (processedCount > 0 || failedCount > 0) {
    await db
      .update(BatchJobTable)
      .set({
        processed_count: sql`${BatchJobTable.processed_count} + ${processedCount}`,
        failed_count: sql`${BatchJobTable.failed_count} + ${failedCount}`,
        updatedAt: new Date(),
      })
      .where(eq(BatchJobTable.id, jobId));
  }

  // #5修正: pending + processing をカウント
  const remaining = await countRemainingItems(jobId);
  if (remaining === 0) {
    await db
      .update(BatchJobTable)
      .set({ status: "completed", completed_at: new Date(), updatedAt: new Date() })
      .where(and(eq(BatchJobTable.id, jobId), eq(BatchJobTable.status, "running")));
  }

  const updatedJob = await getJobRow(jobId);
  return { hasMore: remaining > 0, job: mapJobRow(updatedJob!) };
}

/**
 * #2修正: アイテム1件を個別トランザクションで処理。
 * claim(pending→processing) と process を別txに分離し、
 * クラッシュ時に宙に浮くのは最大1件に限定する。
 */
async function processOneItem(
  jobId: string,
  params: unknown,
  handler: { processItem?: (itemKey: string, params: unknown, tx: TransactionClient) => Promise<void> },
): Promise<"completed" | "failed" | null> {
  // Step 1: 1件をアトミックにclaim (pending → processing)
  const claimed = await db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(BatchJobItemTable)
      .where(and(eq(BatchJobItemTable.job_id, jobId), eq(BatchJobItemTable.status, "pending")))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!item) return null;

    await tx
      .update(BatchJobItemTable)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(BatchJobItemTable.id, item.id));

    return item;
  });

  if (!claimed) return null;

  // Step 2: 処理実行（別トランザクション）
  try {
    await db.transaction(async (tx) => {
      await handler.processItem!(claimed.item_key, params, tx);

      await tx
        .update(BatchJobItemTable)
        .set({ status: "completed", processed_at: new Date(), updatedAt: new Date() })
        .where(eq(BatchJobItemTable.id, claimed.id));
    });
    return "completed";
  } catch (error) {
    // 処理失敗: failed に遷移（txロールバック後なのでtx外で更新）
    const errorMessage = error instanceof Error ? error.message : String(error);
    await db
      .update(BatchJobItemTable)
      .set({
        status: "failed",
        error_message: errorMessage,
        retry_count: sql`${BatchJobItemTable.retry_count} + 1`,
        processed_at: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(BatchJobItemTable.id, claimed.id));
    return "failed";
  }
}

/**
 * #1修正: トランザクション内で FOR UPDATE SKIP LOCKED を実行。
 */
async function acquireJobLock(tx: TransactionClient, jobId: string): Promise<JobRow> {
  // レコード存在確認（ロック外）
  const exists = await tx
    .select({ id: BatchJobTable.id })
    .from(BatchJobTable)
    .where(eq(BatchJobTable.id, jobId))
    .then((rows) => rows.length > 0);

  if (!exists) {
    throw new DomainError("ジョブが見つかりません", { status: 404 });
  }

  // FOR UPDATE SKIP LOCKED でロック取得
  const [locked] = await tx
    .select()
    .from(BatchJobTable)
    .where(eq(BatchJobTable.id, jobId))
    .for("update", { skipLocked: true });

  if (!locked) {
    throw new DomainError("別のプロセスが実行中です", { status: 409 });
  }

  return locked;
}

/**
 * 完了判定: 残りアイテムが0件ならcompleted遷移し、結果を返す。
 * tx内で呼ぶ（processChunkモード用）。
 */
async function checkAndComplete(
  tx: TransactionClient,
  jobId: string,
): Promise<{ hasMore: boolean; job: BatchJob }> {
  const remaining = await countRemainingItemsInTx(tx, jobId);

  if (remaining === 0) {
    await tx
      .update(BatchJobTable)
      .set({ status: "completed", completed_at: new Date(), updatedAt: new Date() })
      .where(and(eq(BatchJobTable.id, jobId), eq(BatchJobTable.status, "running")));
  }

  const [updatedJob] = await tx.select().from(BatchJobTable).where(eq(BatchJobTable.id, jobId));
  return { hasMore: remaining > 0, job: mapJobRow(updatedJob) };
}

/**
 * #5修正: pending + processing の残りアイテム数を取得（tx外用）。
 */
async function countRemainingItems(jobId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(BatchJobItemTable)
    .where(
      and(
        eq(BatchJobItemTable.job_id, jobId),
        inArray(BatchJobItemTable.status, ["pending", "processing"]),
      ),
    );
  return result?.count ?? 0;
}

/** tx内用の残りアイテム数取得 */
async function countRemainingItemsInTx(tx: TransactionClient, jobId: string): Promise<number> {
  const [result] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(BatchJobItemTable)
    .where(
      and(
        eq(BatchJobItemTable.job_id, jobId),
        inArray(BatchJobItemTable.status, ["pending", "processing"]),
      ),
    );
  return result?.count ?? 0;
}

/** ジョブレコードを取得 */
async function getJobRow(jobId: string) {
  const [row] = await db.select().from(BatchJobTable).where(eq(BatchJobTable.id, jobId));
  return row ?? null;
}

/** DBレコードを BatchJob 型に変換 */
function mapJobRow(row: JobRow): BatchJob {
  return {
    id: row.id,
    jobType: row.job_type,
    jobKey: row.job_key,
    status: row.status as BatchJobStatus,
    totalCount: row.total_count,
    processedCount: row.processed_count,
    failedCount: row.failed_count,
    skippedCount: row.skipped_count,
    batchSize: row.batch_size,
    maxRetryCount: row.max_retry_count,
    params: row.params,
    targetQuery: row.target_query,
    errorSummary: row.error_summary,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// --- 公開API ---

export const batchJobService = {
  createJob,
  executeChunk,
  executeAll,
  cancel,
  getProgress,
  recoverStaleItems,
};

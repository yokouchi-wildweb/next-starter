// src/features/core/batchJob/types/index.ts

import type { TransactionClient } from "@/lib/drizzle/transaction";

// --- ステータス ---

export const BATCH_JOB_STATUSES = ["pending", "running", "completed", "failed", "cancelled"] as const;
export type BatchJobStatus = (typeof BATCH_JOB_STATUSES)[number];

export const BATCH_JOB_ITEM_STATUSES = ["pending", "processing", "completed", "failed", "skipped"] as const;
export type BatchJobItemStatus = (typeof BATCH_JOB_ITEM_STATUSES)[number];

// --- エンティティ ---

export type BatchJob = {
  id: string;
  jobType: string;
  jobKey: string;
  status: BatchJobStatus;
  totalCount: number;
  processedCount: number;
  failedCount: number;
  skippedCount: number;
  batchSize: number;
  maxRetryCount: number;
  params: unknown;
  targetQuery: unknown;
  errorSummary: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type BatchJobItem = {
  id: string;
  jobId: string;
  itemKey: string;
  status: BatchJobItemStatus;
  retryCount: number;
  errorMessage: string | null;
  processedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

// --- ハンドラ ---

export type ChunkResult = {
  succeeded: string[];
  failed: { itemKey: string; error: string }[];
  skipped: { itemKey: string; reason: string }[];
};

export type BatchJobHandler<TParams = unknown> = {
  /** DB操作中心: チャンク全体が1トランザクション */
  processChunk?: (itemKeys: string[], params: TParams, tx: TransactionClient) => Promise<ChunkResult>;
  /** 外部API・長時間処理: アイテムごとにトランザクション */
  processItem?: (itemKey: string, params: TParams, tx: TransactionClient) => Promise<void>;
  /** processItemモード専用: processing→pendingリカバリのタイムアウト(ms) */
  recoveryTimeoutMs?: number;
};

// --- サービス入出力 ---

export type CreateJobInput = {
  jobType: string;
  jobKey: string;
  params: unknown;
  itemKeys: string[];
  batchSize?: number;
  maxRetryCount?: number;
  targetQuery?: unknown;
};

export type ExecuteAllResult = {
  hasMore: boolean;
  job: BatchJob;
};

export type JobProgress = {
  id: string;
  status: BatchJobStatus;
  totalCount: number;
  processedCount: number;
  failedCount: number;
  skippedCount: number;
  errorSummary: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date | null;
};

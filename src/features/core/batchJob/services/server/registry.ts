// src/features/core/batchJob/services/server/registry.ts

import type { BatchJobHandler } from "@/features/batchJob/types";

const handlers = new Map<string, BatchJobHandler>();

/**
 * バッチジョブハンドラを登録する。
 * processChunk と processItem は排他（両方定義 or 両方未定義はエラー）。
 */
export function registerBatchJobHandler<TParams = unknown>(
  jobType: string,
  handler: BatchJobHandler<TParams>,
): void {
  validateHandler(jobType, handler as BatchJobHandler);

  if (handlers.has(jobType)) {
    throw new Error(`バッチジョブハンドラ "${jobType}" は既に登録されています`);
  }

  handlers.set(jobType, handler as BatchJobHandler);
}

/**
 * 登録済みハンドラを取得する。未登録の場合はエラー。
 */
export function getHandler(jobType: string): BatchJobHandler {
  const handler = handlers.get(jobType);
  if (!handler) {
    throw new Error(`バッチジョブハンドラ "${jobType}" が登録されていません`);
  }
  return handler;
}

/**
 * ハンドラのバリデーション。
 * processChunk/processItem の排他チェックを行う。
 */
function validateHandler(jobType: string, handler: BatchJobHandler): void {
  const hasChunk = typeof handler.processChunk === "function";
  const hasItem = typeof handler.processItem === "function";

  if (hasChunk && hasItem) {
    throw new Error(
      `バッチジョブハンドラ "${jobType}": processChunk と processItem は排他です。どちらか一方のみ定義してください`,
    );
  }

  if (!hasChunk && !hasItem) {
    throw new Error(
      `バッチジョブハンドラ "${jobType}": processChunk または processItem のいずれかを定義してください`,
    );
  }

  if (handler.recoveryTimeoutMs != null && !hasItem) {
    throw new Error(
      `バッチジョブハンドラ "${jobType}": recoveryTimeoutMs は processItem モード専用です`,
    );
  }
}

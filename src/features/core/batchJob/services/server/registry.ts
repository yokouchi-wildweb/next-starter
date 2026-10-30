// src/features/core/batchJob/services/server/registry.ts

import { jobHandlers } from "@/features/core/batchJob/extensions/jobHandlers";
import type { BatchJobHandler } from "@/features/batchJob/types";

let memo: Map<string, BatchJobHandler> | null = null;

// 項目(jobHandlers/<名前>[.<fork の名前>].ts の export const jobHandler)を検査して組み立てる。読み込みの途中で一覧を触らないよう初回に。
// enabled が false の項目は無いものとして扱う(機能が無効ならテーブルが無い場合がある)
function handlers(): Map<string, BatchJobHandler> {
  if (memo) return memo;
  const map = new Map<string, BatchJobHandler>();
  for (const { jobType, enabled, ...handler } of jobHandlers) {
    if (!(enabled?.() ?? true)) continue;
    validateHandler(jobType, handler);
    if (map.has(jobType)) {
      throw new Error(`バッチジョブハンドラ "${jobType}" が複数あります`);
    }
    map.set(jobType, handler);
  }
  memo = map;
  return map;
}

/**
 * ハンドラを取得する。無い場合はエラー。
 */
export function getHandler(jobType: string): BatchJobHandler {
  const handler = handlers().get(jobType);
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

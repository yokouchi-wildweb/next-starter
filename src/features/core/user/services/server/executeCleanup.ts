// src/features/core/user/services/server/executeCleanup.ts

import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { requiredHandlers, optionalHandlers } from "@/registry/userCleanupRegistry";

/**
 * ユーザーソフトデリート時のクリーンナップ処理を実行する
 * - requiredHandlers: 失敗時はエラーをスローし、トランザクション全体をロールバック
 * - optionalHandlers: 失敗時はログを記録して続行
 */
export async function executeCleanup(userId: string, tx: DbTransaction): Promise<void> {
  // 必須ハンドラを順次実行（失敗時はそのままスロー）
  for (const handler of requiredHandlers) {
    await handler(userId, tx);
  }

  // 任意ハンドラを順次実行（失敗時はログを記録して続行）
  for (const handler of optionalHandlers) {
    try {
      await handler(userId, tx);
    } catch (error) {
      console.error(`[userCleanup] Optional cleanup failed for user ${userId}:`, error);
    }
  }
}

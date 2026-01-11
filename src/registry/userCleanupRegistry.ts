// src/registry/userCleanupRegistry.ts

import type { DbTransaction } from "@/lib/crud/drizzle/types";

/**
 * ユーザーソフトデリート時に実行されるクリーンナップハンドラの型
 */
export type UserCleanupHandler = (userId: string, tx: DbTransaction) => Promise<void>;

/**
 * 必須ハンドラ: 失敗した場合は全体をロールバック
 * 記載順に実行される
 */
const requiredHandlers: UserCleanupHandler[] = [
  // 例: userCleanupService.setStatusWithdrawn,
  // 例: walletCleanupService.clearBalance,
];

/**
 * 任意ハンドラ: 失敗してもログを記録して続行
 * 記載順に実行される（必須ハンドラの後に実行）
 */
const optionalHandlers: UserCleanupHandler[] = [
  // 例: purchaseRequestCleanupService.cancelPending,
];

/**
 * 全てのクリーンナップハンドラを実行する
 * - requiredHandlers: 失敗時はエラーをスローし、トランザクション全体をロールバック
 * - optionalHandlers: 失敗時はログを記録して続行
 */
export async function executeUserCleanup(userId: string, tx: DbTransaction): Promise<void> {
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

// src/features/core/user/services/server/executeCleanup.ts

import { cleanupHandlers } from "@/features/core/user/extensions/cleanupHandlers";
import type { DbTransaction } from "@/lib/crud/drizzle/types";

import { runCleanupItems } from "./cleanup";

/**
 * ユーザーソフトデリート時のクリーンナップ処理を実行する
 * - required: 失敗時はエラーをスローし、トランザクション全体をロールバック
 * - それ以外: 失敗時はログを記録して続行
 */
export async function executeCleanup(userId: string, tx: DbTransaction): Promise<void> {
  await runCleanupItems(cleanupHandlers, userId, tx);
}

// src/features/core/user/services/server/cleanup.ts
// 退会・ソフトデリートの後片付けの項目の型と実行(一覧は読まない。一覧: ../../extensions/cleanupHandlers.ts、呼び手: ./executeCleanup.ts)

import type { DbTransaction } from "@/lib/crud/drizzle/types";

export type UserCleanupHandler = (userId: string, tx: DbTransaction) => Promise<void>;

/** 後片付けの項目(src/features/core/user/cleanupHandlers/<名前>[.<fork の名前>].ts の export const handler) */
export type UserCleanupItem = {
  /** true: 失敗したら全体をロールバック / false: 失敗してもログを記録して続行 */
  required: boolean;
  /** 機能が無効ならテーブルが無い場合があるので、無効の間は走らせない(省略 = 常に走る) */
  enabled?: () => boolean;
  run: UserCleanupHandler;
};

/**
 * 必須 → 任意の順に実行する(それぞれ一覧の順 = ファイル名の順)
 * ステータス変更は各呼び出し元の責任(ここでは変えない)
 */
export async function runCleanupItems(items: readonly UserCleanupItem[], userId: string, tx: DbTransaction): Promise<void> {
  const active = items.filter((item) => item.enabled?.() ?? true);
  for (const item of active.filter((i) => i.required)) {
    await item.run(userId, tx);
  }
  for (const item of active.filter((i) => !i.required)) {
    try {
      await item.run(userId, tx);
    } catch (error) {
      console.error(`[userCleanup] Optional cleanup failed for user ${userId}:`, error);
    }
  }
}

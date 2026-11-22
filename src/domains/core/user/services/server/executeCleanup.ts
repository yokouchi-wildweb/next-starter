// src/domains/core/user/services/server/executeCleanup.ts

import { userCleanupHandlers } from "@/domains/core/user/extensions/userCleanupHandlers";
import type { DbTransaction } from "@/lib/crud/server";

import { runCleanupItems } from "./cleanup";

/**
 * ユーザーソフトデリート時のクリーンナップ処理を実行する
 * - required: 失敗時はエラーをスローし、トランザクション全体をロールバック
 * - それ以外: 失敗時はログを記録して続行
 */
export async function executeCleanup(userId: string, tx: DbTransaction): Promise<void> {
  // 常に読む一覧(alwaysOn): 門番で絞らない(閉じたドメインの利用者の行も片付ける)。項目の enabled が自分で閉じる
  await runCleanupItems(
    userCleanupHandlers.map((entry) => entry.plug),
    userId,
    tx,
  );
}

// src/features/core/user/services/server/wrappers/softDelete.ts

import { auditLogger } from "@/features/core/auditLog/services/server";
import { DomainError } from "@/lib/errors";
import { executeCleanup } from "@/features/core/user/services/server/executeCleanup";
import { setStatusWithdrawn } from "@/features/core/user/services/server/setStatusWithdrawn";
import { db } from "@/lib/drizzle";
import { base } from "../drizzleBase";

export type SoftDeleteInput = {
  userId: string;
  reason?: string;
};

/**
 * ユーザーを論理削除し、クリーンナップ処理を実行する。
 * - 論理削除・クリーンナップ・監査ログを同一トランザクション内で実行
 * - 必須クリーンナップが失敗した場合は監査ログ含めて全体がロールバック
 *
 * actor は AsyncLocalStorage 経由で routeFactory から自動注入される。
 */
export async function softDelete(input: SoftDeleteInput): Promise<void> {
  const { userId, reason } = input;

  const currentUser = await base.get(userId);
  if (!currentUser) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  if (currentUser.deletedAt) {
    throw new DomainError("このユーザーは既に削除されています", { status: 400 });
  }

  await db.transaction(async (tx) => {
    await base.remove(userId, tx);
    await setStatusWithdrawn(userId, tx);
    await executeCleanup(userId, tx);

    await auditLogger.record({
      targetType: "user",
      targetId: userId,
      action: "user.soft_deleted",
      before: { status: currentUser.status, deletedAt: null },
      after: { status: currentUser.status, deletedAt: new Date().toISOString() },
      reason: reason ?? null,
      tx,
    });
  });
}

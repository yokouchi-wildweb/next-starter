// src/features/core/user/services/server/wrappers/softDelete.ts

import { DomainError } from "@/lib/errors";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
import { base } from "../drizzleBase";

export type SoftDeleteInput = {
  userId: string;
  actorId: string;
  reason?: string;
};

/**
 * ユーザーを論理削除し、アクションログを記録する
 */
export async function softDelete(input: SoftDeleteInput): Promise<void> {
  const { userId, actorId, reason } = input;

  // 現在のユーザー情報を取得
  const currentUser = await base.get(userId);
  if (!currentUser) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  // 既に削除済みの場合はエラー
  if (currentUser.deletedAt) {
    throw new DomainError("このユーザーは既に削除されています", { status: 400 });
  }

  // 論理削除を実行
  await base.remove(userId);

  // アクションログを記録
  await userActionLogService.create({
    targetUserId: userId,
    actorId,
    actorType: "admin",
    actionType: "admin_soft_delete",
    beforeValue: {
      status: currentUser.status,
      deletedAt: null,
    },
    afterValue: {
      status: currentUser.status,
      deletedAt: new Date().toISOString(),
    },
    reason: reason ?? null,
  });
}

// src/features/core/user/services/server/withdraw.ts

import type { User } from "@/features/core/user/entities";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
import { executeCleanup } from "@/features/core/user/services/server/executeCleanup";
import { DomainError } from "@/lib/errors";
import { db } from "@/lib/drizzle";
import { base } from "./drizzleBase";

export type WithdrawResult = {
  user: User;
};

/**
 * ユーザーの退会処理を行う。
 * - ステータスを "withdrawn" に変更
 * - リソースクリーンナップ（ウォレット残高クリア、購入リクエストキャンセル等）
 * - アクションログを記録
 *
 * ステータス変更とクリーンナップは同一トランザクション内で実行される。
 * セッションの削除は API ルートで行う。
 */
export async function withdraw(userId: string): Promise<WithdrawResult> {
  const user = await base.get(userId);

  if (!user) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  if (user.status === "withdrawn") {
    throw new DomainError("すでに退会済みです", { status: 400 });
  }

  if (user.status !== "active") {
    throw new DomainError("退会できるステータスではありません", { status: 400 });
  }

  const beforeStatus = user.status;

  // ステータス変更とリソースクリーンナップをトランザクション内で実行
  const updatedUser = await db.transaction(async (tx) => {
    const updated = await base.update(userId, {
      status: "withdrawn",
    } as Partial<User>, tx);

    // リソースクリーンナップ（ウォレット残高クリア等）
    await executeCleanup(userId, tx);

    return updated;
  });

  // 退会ログを記録（トランザクション外）
  await userActionLogService.create({
    targetUserId: userId,
    actorId: userId,
    actorType: "user",
    actionType: "user_withdraw",
    beforeValue: { status: beforeStatus },
    afterValue: { status: "withdrawn" },
    reason: null,
  });

  return {
    user: updatedUser,
  };
}

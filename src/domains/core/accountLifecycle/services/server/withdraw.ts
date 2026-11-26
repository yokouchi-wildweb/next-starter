// src/domains/core/accountLifecycle/services/server/withdraw.ts

import type { User } from "@/domains/core/user/entities";
import { auditLogger } from "@/domains/core/auditLog/services/server";
import { executeCleanup } from "@/domains/core/user/services/server/executeCleanup";
import { recordStatusTransition } from "@/domains/core/user/services/server/statusHistory";
import { DomainError } from "@/lib/errors";
import { db } from "@/lib/drizzle";
import { userBase } from "@/domains/core/user/services/server/userBase";

export type WithdrawResult = {
  user: User;
};

/**
 * ユーザーの退会処理を行う。
 * - ステータスを "withdrawn" に変更
 * - リソースクリーンナップ（ウォレット残高クリア、購入リクエストキャンセル等）
 * - 監査ログを記録（同一トランザクション内）
 *
 * セッションの削除は API ルートで行う。
 * actor は AsyncLocalStorage 経由で routeFactory から自動注入される。
 */
export async function withdraw(userId: string): Promise<WithdrawResult> {
  const user = await userBase.get(userId);

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

  const updatedUser = await db.transaction(async (tx) => {
    const updated = await userBase.update(userId, {
      status: "withdrawn",
    } as Partial<User>, tx);

    await recordStatusTransition({
      userId,
      fromStatus: beforeStatus,
      toStatus: "withdrawn",
      trigger: "self_withdraw",
      tx,
    });

    await executeCleanup(userId, tx);

    await auditLogger.record({
      targetType: "user",
      targetId: userId,
      subjectUserId: userId,
      action: "user.withdrew",
      before: { status: beforeStatus },
      after: { status: "withdrawn" },
      tx,
    });

    return updated;
  });

  return {
    user: updatedUser,
  };
}

// src/features/core/user/services/server/withdraw.ts

import type { User } from "@/features/core/user/entities";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
import { DomainError } from "@/lib/errors";
import { base } from "./drizzleBase";

export type WithdrawResult = {
  user: User;
};

/**
 * ユーザーの退会処理を行う。
 * - ステータスを "withdrawn" に変更
 * - アクションログを記録
 *
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

  const updatedUser = await base.update(userId, {
    status: "withdrawn",
  } as Partial<User>);

  // 退会ログを記録
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

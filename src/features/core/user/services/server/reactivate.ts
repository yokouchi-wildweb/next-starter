// src/features/core/user/services/server/reactivate.ts

import type { User } from "@/features/core/user/entities";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
import { DomainError } from "@/lib/errors";
import { base } from "./drizzleBase";

export type ReactivateResult = {
  user: User;
};

/**
 * ユーザーの復帰処理を行う。
 * - ステータスを "active" に変更
 * - アクションログを記録
 */
export async function reactivate(userId: string): Promise<ReactivateResult> {
  const user = await base.get(userId);

  if (!user) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  if (user.status === "active") {
    throw new DomainError("すでにアクティブです", { status: 400 });
  }

  if (user.status !== "inactive") {
    throw new DomainError("復帰できるステータスではありません", { status: 400 });
  }

  const beforeStatus = user.status;

  const updatedUser = await base.update(userId, {
    status: "active",
  } as Partial<User>);

  // 復帰ログを記録
  await userActionLogService.create({
    targetUserId: userId,
    actorId: userId,
    actorType: "user",
    actionType: "user_reactivate",
    beforeValue: { status: beforeStatus },
    afterValue: { status: "active" },
    reason: null,
  });

  return {
    user: updatedUser,
  };
}

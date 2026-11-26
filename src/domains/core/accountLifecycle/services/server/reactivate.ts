// src/domains/core/accountLifecycle/services/server/reactivate.ts

import type { User } from "@/domains/core/user/entities";
import { auditLogger } from "@/domains/core/auditLog/services/server";
import { recordStatusTransition } from "@/domains/core/user/services/server/statusHistory";
import { DomainError } from "@/lib/errors";
import { userBase } from "@/domains/core/user/services/server/userBase";

export type ReactivateResult = {
  user: User;
};

/**
 * ユーザーの復帰処理を行う。
 * - ステータスを "active" に変更
 * - 監査ログを記録
 *
 * actor は AsyncLocalStorage 経由で routeFactory から自動注入される。
 */
export async function reactivate(userId: string): Promise<ReactivateResult> {
  const user = await userBase.get(userId);

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

  const updatedUser = await userBase.update(userId, {
    status: "active",
  } as Partial<User>);

  await recordStatusTransition({
    userId,
    fromStatus: beforeStatus,
    toStatus: "active",
    trigger: "self_reactivate",
  });

  await auditLogger.record({
    targetType: "user",
    targetId: userId,
    subjectUserId: userId,
    action: "user.reactivated",
    before: { status: beforeStatus },
    after: { status: "active" },
  });

  return {
    user: updatedUser,
  };
}

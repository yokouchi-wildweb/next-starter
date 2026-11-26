// src/domains/core/accountLifecycle/services/server/pause.ts

import type { User } from "@/domains/core/user/entities";
import { auditLogger } from "@/domains/core/auditLog/services/server";
import { recordStatusTransition } from "@/domains/core/user/services/server/statusHistory";
import { DomainError } from "@/lib/errors";
import { userBase } from "@/domains/core/user/services/server/userBase";

export type PauseResult = {
  user: User;
};

/**
 * ユーザーの休会処理を行う。
 * - ステータスを "inactive" に変更
 * - 監査ログを記録（actor はユーザー本人）
 *
 * セッションの削除は API ルートで行う。
 * actor は AsyncLocalStorage 経由で routeFactory から自動注入される。
 */
export async function pause(userId: string): Promise<PauseResult> {
  const user = await userBase.get(userId);

  if (!user) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  if (user.status === "inactive") {
    throw new DomainError("すでに休会中です", { status: 400 });
  }

  if (user.status !== "active") {
    throw new DomainError("休会できるステータスではありません", { status: 400 });
  }

  const beforeStatus = user.status;

  const updatedUser = await userBase.update(userId, {
    status: "inactive",
  } as Partial<User>);

  await recordStatusTransition({
    userId,
    fromStatus: beforeStatus,
    toStatus: "inactive",
    trigger: "self_pause",
  });

  await auditLogger.record({
    targetType: "user",
    targetId: userId,
    subjectUserId: userId,
    action: "user.paused",
    before: { status: beforeStatus },
    after: { status: "inactive" },
  });

  return {
    user: updatedUser,
  };
}

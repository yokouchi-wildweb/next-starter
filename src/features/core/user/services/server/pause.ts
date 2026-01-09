// src/features/core/user/services/server/pause.ts

import type { User } from "@/features/core/user/entities";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
import { DomainError } from "@/lib/errors";
import { base } from "./drizzleBase";

export type PauseResult = {
  user: User;
};

/**
 * ユーザーの休会処理を行う。
 * - ステータスを "inactive" に変更
 * - アクションログを記録
 *
 * セッションの削除は API ルートで行う。
 */
export async function pause(userId: string): Promise<PauseResult> {
  const user = await base.get(userId);

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

  const updatedUser = await base.update(userId, {
    status: "inactive",
  } as Partial<User>);

  // 休会ログを記録
  await userActionLogService.create({
    targetUserId: userId,
    actorId: userId,
    actorType: "user",
    actionType: "user_pause",
    beforeValue: { status: beforeStatus },
    afterValue: { status: "inactive" },
    reason: null,
  });

  return {
    user: updatedUser,
  };
}

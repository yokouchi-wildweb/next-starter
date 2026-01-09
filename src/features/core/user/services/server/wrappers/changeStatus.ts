// src/features/core/user/services/server/wrappers/changeStatus.ts

import type { User } from "@/features/core/user/entities";
import type { UserStatus } from "@/features/core/user/types";
import { DomainError } from "@/lib/errors";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
import { base } from "../drizzleBase";

export type ChangeStatusInput = {
  userId: string;
  newStatus: UserStatus;
  actorId: string;
  reason?: string;
};

/**
 * ユーザーのステータスを変更し、アクションログを記録する
 */
export async function changeStatus(input: ChangeStatusInput): Promise<User> {
  const { userId, newStatus, actorId, reason } = input;

  // 現在のユーザー情報を取得
  const currentUser = await base.get(userId);
  if (!currentUser) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  const beforeStatus = currentUser.status;

  // 同じステータスへの変更は不可
  if (beforeStatus === newStatus) {
    throw new DomainError("現在と同じステータスには変更できません", { status: 400 });
  }

  // ステータスを更新
  const updatePayload = { status: newStatus } as Partial<User>;
  const updatedUser = await base.update(userId, updatePayload);

  // アクションログを記録
  await userActionLogService.create({
    targetUserId: userId,
    actorId,
    actorType: "admin",
    actionType: "admin_status_change",
    beforeValue: { status: beforeStatus },
    afterValue: { status: newStatus },
    reason: reason ?? null,
  });

  return updatedUser;
}

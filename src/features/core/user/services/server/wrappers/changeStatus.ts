// src/features/core/user/services/server/wrappers/changeStatus.ts

import type { User } from "@/features/core/user/entities";
import type { UserStatus } from "@/features/core/user/types";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { DomainError } from "@/lib/errors";
import { base } from "../drizzleBase";

export type ChangeStatusInput = {
  userId: string;
  newStatus: UserStatus;
  reason?: string;
};

/**
 * ユーザーのステータスを変更し、監査ログを記録する。
 * actor は AsyncLocalStorage 経由で routeFactory から自動注入される。
 */
export async function changeStatus(input: ChangeStatusInput): Promise<User> {
  const { userId, newStatus, reason } = input;

  const currentUser = await base.get(userId);
  if (!currentUser) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  const beforeStatus = currentUser.status;

  if (beforeStatus === newStatus) {
    throw new DomainError("現在と同じステータスには変更できません", { status: 400 });
  }

  const updatePayload = { status: newStatus } as Partial<User>;
  const updatedUser = await base.update(userId, updatePayload);

  await auditLogger.record({
    targetType: "user",
    targetId: userId,
    action: "user.status.changed",
    before: { status: beforeStatus },
    after: { status: newStatus },
    reason: reason ?? null,
  });

  return updatedUser;
}

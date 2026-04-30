// src/features/core/user/services/server/wrappers/hardDelete.ts
// ハードデリート: Firebase Auth と DB レコードを物理削除し、監査ログを記録

import { deleteAuthUser } from "@/lib/firebase/server/authAdmin";
import { auditLogger } from "@/features/core/auditLog";
import { DomainError } from "@/lib/errors";
import { getRoleCategory } from "@/features/core/user/constants";
import { base } from "../drizzleBase";

export type HardDeleteInput = {
  userId: string;
  reason?: string;
};

/**
 * ユーザーを物理削除し、監査ログを記録する。
 * 削除前のユーザー情報はすべて before に格納される。
 *
 * actor は AsyncLocalStorage 経由で routeFactory から自動注入される。
 */
export async function hardDelete(input: HardDeleteInput): Promise<void> {
  const { userId, reason } = input;

  const user = await base.getWithDeleted(userId);

  if (!user) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  // 削除前に監査ログを記録（物理削除すると ID 経由の参照が不能になるため）
  await auditLogger.record({
    targetType: "user",
    targetId: userId,
    action: "user.hard_deleted",
    before: user as unknown as Record<string, unknown>,
    reason: reason ?? null,
  });

  // Firebase Auth を削除（user カテゴリのロールは Firebase 連携している）
  if (getRoleCategory(user.role) === "user" && user.providerUid) {
    await deleteAuthUser(user.providerUid);
  }

  await base.hardDelete(userId);
}

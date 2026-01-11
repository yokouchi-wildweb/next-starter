// src/features/user/services/server/wrappers/hardDelete.ts
// ハードデリート: Firebase AuthとDBレコードを物理削除し、アクションログを記録

import { deleteAuthUser } from "@/lib/firebase/server/authAdmin";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
import { DomainError } from "@/lib/errors";
import { base } from "../drizzleBase";

export type HardDeleteInput = {
  userId: string;
  actorId: string;
  reason?: string;
};

/**
 * ユーザーを物理削除し、アクションログを記録する
 * 削除前のユーザー情報はすべてbeforeValueに格納される
 */
export async function hardDelete(input: HardDeleteInput): Promise<void> {
  const { userId, actorId, reason } = input;

  // ソフトデリート済みでも取得できるようにgetWithDeletedを使用
  const user = await base.getWithDeleted(userId);

  if (!user) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  // アクションログを記録（物理削除前に記録）
  // ユーザーIDを含むすべての情報をbeforeValueに格納
  await userActionLogService.create({
    targetUserId: userId,
    actorId,
    actorType: "admin",
    actionType: "admin_hard_delete",
    beforeValue: user,
    afterValue: null,
    reason: reason ?? null,
  });

  // Firebase Authを削除
  if (user.role === "user" && user.providerUid) {
    await deleteAuthUser(user.providerUid);
  }

  // DBレコードを物理削除
  await base.hardDelete(userId);
}

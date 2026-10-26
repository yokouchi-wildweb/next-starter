// src/features/core/user/services/server/wrappers/hardDelete.ts
// ハードデリート: Firebase Auth と DB レコードを物理削除し、監査ログを記録。
// アバターは users の storage binding が物理削除と同じ TX で外して消す。その人の未使用のアップロードは削除の後に取り消す（D41）

import { deleteAuthUser } from "@/lib/firebase/server/authAdmin";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { storageObjectService } from "@/features/core/storageObject/services/server/storageObjectService";
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
    subjectUserId: userId,
    action: "user.hard_deleted",
    before: user as unknown as Record<string, unknown>,
    reason: reason ?? null,
  });

  // Firebase Auth を削除（user カテゴリのロールは Firebase 連携している）
  if (getRoleCategory(user.role) === "user" && user.providerUid) {
    await deleteAuthUser(user.providerUid);
  }

  await base.hardDelete(userId);

  // その人がアップロードしてまだどこにも紐付いていないファイルを取り消して消す（他の行・チャットが参照するファイルは残る）。
  // 行の削除は済んでいるので失敗しても throw しない（掃除 cron が期限・猶予の後に消す）
  try {
    await storageObjectService.discardAllOwnedBy(userId);
  } catch (error) {
    console.error(`[user] 物理削除したユーザーの未使用ファイルの取り消しに失敗しました（掃除 cron が後で消す）: ${userId}`, error);
  }
}

// src/features/core/user/services/server/creation/console/restore.ts

import type { User } from "@/features/core/user/entities";
import { DomainError } from "@/lib/errors";
import { getServerAuth } from "@/lib/firebase/server/app";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
import { createHash } from "@/utils/hash";
import { base } from "../../drizzleBase";

export type RestoreSoftDeletedUserInput = {
  existingUser: User;
  name: string;
  localPassword: string;
  role: string;
  actorId?: string;
  isDemo?: boolean;
};

/**
 * ソフトデリート済みユーザーを復元し、新しい情報で更新する。
 * - deletedAtをnullに戻す（restore）
 * - statusをactiveに変更
 * - name、パスワード、roleを更新
 * - アクションログに「管理者からの再登録」として記録
 */
export async function restoreSoftDeletedUser(data: RestoreSoftDeletedUserInput): Promise<User> {
  const { existingUser, name, localPassword, role, actorId, isDemo } = data;

  // ソフトデリート済みでなければエラー
  if (!existingUser.deletedAt) {
    throw new DomainError("このユーザーはソフトデリートされていません", { status: 400 });
  }

  // beforeValueを記録
  const beforeValue = {
    role: existingUser.role,
    status: existingUser.status,
    email: existingUser.email,
    name: existingUser.name,
    providerType: existingUser.providerType,
    deletedAt: existingUser.deletedAt,
  };

  // Firebase認証ユーザーの場合はパスワードを更新
  if (existingUser.providerType === "email") {
    const auth = getServerAuth();
    try {
      await auth.updateUser(existingUser.providerUid, {
        password: localPassword,
        displayName: name || undefined,
      });
    } catch {
      throw new DomainError("Firebase認証情報の更新に失敗しました", { status: 500 });
    }
  }

  // restore（deletedAtをnullに）
  await base.restore(existingUser.id);

  // ユーザー情報を更新
  const updatePayload: Partial<User> = {
    status: "active",
    name,
    role,
  };

  // ローカル認証の場合はパスワードをハッシュ化して更新
  if (existingUser.providerType === "local") {
    updatePayload.localPassword = await createHash(localPassword);
  }

  // isDemoフラグを設定
  if (isDemo !== undefined) {
    updatePayload.isDemo = isDemo;
  }

  const updatedUser = await base.update(existingUser.id, updatePayload);

  // アクションログを記録
  if (actorId) {
    await userActionLogService.create({
      targetUserId: updatedUser.id,
      actorId,
      actorType: "admin",
      actionType: "admin_reregister_user",
      beforeValue,
      afterValue: {
        role: updatedUser.role,
        status: updatedUser.status,
        email: updatedUser.email,
        name: updatedUser.name,
        providerType: updatedUser.providerType,
        deletedAt: null,
      },
      reason: "管理者による再登録",
    });
  }

  return updatedUser;
}

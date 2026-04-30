// src/features/core/user/services/server/creation/console/restore.ts

import type { User } from "@/features/core/user/entities";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { DomainError } from "@/lib/errors";
import { getServerAuth } from "@/lib/firebase/server/app";
import { createHash } from "@/utils/hash";
import { base } from "../../drizzleBase";

export type RestoreSoftDeletedUserInput = {
  existingUser: User;
  name: string;
  localPassword: string;
  role: string;
  isDemo?: boolean;
};

/**
 * ソフトデリート済みユーザーを復元し、新しい情報で更新する。
 * - deletedAt を null に戻す（restore）
 * - status を active に変更
 * - name、パスワード、role を更新
 * - 監査ログに「管理者からの再登録」として記録
 *
 * actor は AsyncLocalStorage 経由で routeFactory から自動注入される。
 */
export async function restoreSoftDeletedUser(data: RestoreSoftDeletedUserInput): Promise<User> {
  const { existingUser, name, localPassword, role, isDemo } = data;

  if (!existingUser.deletedAt) {
    throw new DomainError("このユーザーはソフトデリートされていません", { status: 400 });
  }

  const before = {
    role: existingUser.role,
    status: existingUser.status,
    email: existingUser.email,
    name: existingUser.name,
    providerType: existingUser.providerType,
    deletedAt: existingUser.deletedAt,
  };

  // Firebase 認証ユーザーの場合はパスワードを更新
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

  // restore（deletedAt を null に）
  await base.restore(existingUser.id);

  const updatePayload: Partial<User> = {
    status: "active",
    name,
    role,
  };

  if (existingUser.providerType === "local") {
    updatePayload.localPassword = await createHash(localPassword);
  }

  if (isDemo !== undefined) {
    updatePayload.isDemo = isDemo;
  }

  const updatedUser = await base.update(existingUser.id, updatePayload);

  await auditLogger.record({
    targetType: "user",
    targetId: updatedUser.id,
    action: "user.reregistered_by_admin",
    before,
    after: {
      role: updatedUser.role,
      status: updatedUser.status,
      email: updatedUser.email,
      name: updatedUser.name,
      providerType: updatedUser.providerType,
      deletedAt: null,
    },
    reason: "管理者による再登録",
  });

  return updatedUser;
}

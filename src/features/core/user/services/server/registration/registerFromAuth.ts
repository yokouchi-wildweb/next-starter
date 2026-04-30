// src/features/core/user/services/server/registration/registerFromAuth.ts

import { REGISTRATION_DEFAULT_ROLE } from "@/features/core/auth/constants/registration";
import type { User } from "@/features/core/user/entities";
import type { UserRoleType } from "@/features/core/user/constants";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { updateLastAuthenticated } from "@/features/core/user/services/server/wrappers/updateLastAuthenticated";
import { activate } from "./activate";
import { sendRegistrationCompleteMail } from "./sendRegistrationCompleteMail";

export type RegisterFromAuthInput = {
  email: string;
  name?: string | null;
  existingUser: User;
  role?: string;
  ip?: string;
};

export type RegisterFromAuthResult = {
  user: User;
  isFromPending: boolean;
  isRejoin: boolean;
};

/**
 * auth ドメインからの本登録処理。
 * - 仮登録済みユーザー（pending/withdrawn）を有効化
 * - 監査ログを記録
 *
 * 未認証経路で呼ばれるため、ALS context の actor は "system" になる。
 * 実際は本人による操作なので actorOverride で actorType="user" / actorId=userId に上書きする。
 */
export async function registerFromAuth(
  input: RegisterFromAuthInput,
): Promise<RegisterFromAuthResult> {
  const { email, name, existingUser, role = REGISTRATION_DEFAULT_ROLE, ip } = input;

  const now = new Date();

  const isFromPending = existingUser.status === "pending";
  const isRejoin = existingUser.status === "withdrawn";

  const user = await activate(existingUser.id, {
    role: role as UserRoleType,
    name: name ?? "",
    email: email || null,
    lastAuthenticatedAt: now,
  });

  // 本登録時のログイン履歴を記録
  if (ip) {
    await updateLastAuthenticated(user.id, { ip });
  }

  await recordActionLog({
    user,
    existingUser,
    isFromPending,
    isRejoin,
  });

  // 登録完了メールを送信（失敗しても登録処理は継続）
  if (user.email) {
    try {
      await sendRegistrationCompleteMail({
        email: user.email,
        displayName: user.name || "",
      });
    } catch (error) {
      console.error("Failed to send registration complete mail:", error);
    }
  }

  return {
    user,
    isFromPending,
    isRejoin,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ヘルパー関数
// ─────────────────────────────────────────────────────────────────────────────

type RecordActionLogParams = {
  user: User;
  existingUser: User;
  isFromPending: boolean;
  isRejoin: boolean;
};

async function recordActionLog({
  user,
  existingUser,
  isFromPending,
  isRejoin,
}: RecordActionLogParams): Promise<void> {
  const after = {
    status: user.status,
    email: user.email,
    name: user.name,
    providerType: user.providerType,
  };

  if (isFromPending) {
    await auditLogger.record({
      targetType: "user",
      targetId: user.id,
      action: "user.registered",
      before: { status: existingUser.status },
      after,
      actorOverride: { actorType: "user", actorId: user.id },
    });
  } else if (isRejoin) {
    await auditLogger.record({
      targetType: "user",
      targetId: user.id,
      action: "user.rejoined",
      before: { status: existingUser.status },
      after,
      actorOverride: { actorType: "user", actorId: user.id },
    });
  }
}

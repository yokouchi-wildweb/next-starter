// src/features/core/user/services/server/registration/registerFromAuth.ts

import { REGISTRATION_DEFAULT_ROLE } from "@/features/core/auth/constants/registration";
import type { User } from "@/features/core/user/entities";
import type { UserRoleType } from "@/features/core/user/constants";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
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
 * - アクションログを記録
 */
export async function registerFromAuth(
  input: RegisterFromAuthInput,
): Promise<RegisterFromAuthResult> {
  const { email, name, existingUser, role = REGISTRATION_DEFAULT_ROLE, ip } = input;

  const now = new Date();

  // 状態遷移の判定
  const isFromPending = existingUser.status === "pending";
  const isRejoin = existingUser.status === "withdrawn";

  // ユーザーを有効化
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

  // アクションログを記録
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
  const afterValue = {
    status: user.status,
    email: user.email,
    name: user.name,
    providerType: user.providerType,
  };

  if (isFromPending) {
    await userActionLogService.create({
      targetUserId: user.id,
      actorId: user.id,
      actorType: "user",
      actionType: "user_register",
      beforeValue: { status: existingUser.status },
      afterValue,
      reason: null,
    });
  } else if (isRejoin) {
    await userActionLogService.create({
      targetUserId: user.id,
      actorId: user.id,
      actorType: "user",
      actionType: "user_rejoin",
      beforeValue: { status: existingUser.status },
      afterValue,
      reason: null,
    });
  }
}

// src/features/core/user/services/server/registration/preRegisterFromAuth.ts

import type { User } from "@/features/core/user/entities";
import type { UserProviderType } from "@/features/core/user/types";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
import { setPending } from "./setPending";

export type PreRegisterFromAuthInput = {
  providerType: UserProviderType;
  providerUid: string;
  email: string | null;
  existingUser: User | null;
};

export type PreRegisterFromAuthResult = {
  user: User;
  isRejoin: boolean;
  isNewRegistration: boolean;
};

/**
 * auth ドメインからの仮登録処理。
 * - 新規ユーザーまたは withdrawn ユーザーを pending 状態で作成/更新
 * - アクションログを記録
 */
export async function preRegisterFromAuth(
  input: PreRegisterFromAuthInput,
): Promise<PreRegisterFromAuthResult> {
  const { providerType, providerUid, email, existingUser } = input;

  const now = new Date();

  // 状態遷移の判定
  const isRejoin = existingUser?.status === "withdrawn";
  const isNewRegistration = !existingUser;

  // ユーザーを作成/更新
  const user = await setPending(
    {
      providerType,
      providerUid,
      email,
      lastAuthenticatedAt: now,
    },
    existingUser,
  );

  // アクションログを記録（新規登録または再入会の場合のみ）
  await recordActionLog({
    user,
    existingUser,
    isRejoin,
    isNewRegistration,
  });

  return {
    user,
    isRejoin,
    isNewRegistration,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ヘルパー関数
// ─────────────────────────────────────────────────────────────────────────────

type RecordActionLogParams = {
  user: User;
  existingUser: User | null;
  isRejoin: boolean;
  isNewRegistration: boolean;
};

async function recordActionLog({
  user,
  existingUser,
  isRejoin,
  isNewRegistration,
}: RecordActionLogParams): Promise<void> {
  const afterValue = {
    status: user.status,
    email: user.email,
    providerType: user.providerType,
  };

  if (isRejoin) {
    await userActionLogService.create({
      targetUserId: user.id,
      actorId: user.id,
      actorType: "user",
      actionType: "user_rejoin",
      beforeValue: { status: existingUser!.status },
      afterValue,
      reason: null,
    });
  } else if (isNewRegistration) {
    await userActionLogService.create({
      targetUserId: user.id,
      actorId: user.id,
      actorType: "user",
      actionType: "user_preregister",
      beforeValue: null,
      afterValue,
      reason: null,
    });
  }
  // pending からの再実行の場合はログ不要
}

// src/features/core/user/services/server/registration/preRegisterFromAuth.ts

import type { User } from "@/features/core/user/entities";
import type { UserProviderType } from "@/features/core/user/types";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { setPending } from "./setPending";

export type PreRegisterFromAuthInput = {
  providerType: UserProviderType;
  providerUid: string;
  email: string | null;
  existingUser: User | null;
  ip?: string;
};

export type PreRegisterFromAuthResult = {
  user: User;
  isRejoin: boolean;
  isNewRegistration: boolean;
};

/**
 * auth ドメインからの仮登録処理。
 * - 新規ユーザーまたは withdrawn ユーザーを pending 状態で作成/更新
 * - 監査ログを記録
 *
 * 未認証経路で呼ばれるため、ALS context の actor は "system" になる。
 * 実際は本人による操作なので actorOverride で actorType="user" / actorId=userId に上書きする。
 */
export async function preRegisterFromAuth(
  input: PreRegisterFromAuthInput,
): Promise<PreRegisterFromAuthResult> {
  const { providerType, providerUid, email, existingUser, ip } = input;

  const now = new Date();

  const isRejoin = existingUser?.status === "withdrawn";
  const isNewRegistration = !existingUser;

  // 新規登録または再入会時は signupIp を記録
  const user = await setPending(
    {
      providerType,
      providerUid,
      email,
      lastAuthenticatedAt: now,
      signupIp: (isNewRegistration || isRejoin) ? ip : undefined,
    },
    existingUser,
  );

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
  const after = {
    status: user.status,
    email: user.email,
    providerType: user.providerType,
  };

  if (isRejoin) {
    await auditLogger.record({
      targetType: "user",
      targetId: user.id,
      action: "user.rejoined",
      before: { status: existingUser!.status },
      after,
      actorOverride: { actorType: "user", actorId: user.id },
    });
  } else if (isNewRegistration) {
    await auditLogger.record({
      targetType: "user",
      targetId: user.id,
      action: "user.preregistered",
      before: null,
      after,
      actorOverride: { actorType: "user", actorId: user.id },
    });
  }
  // pending からの再実行の場合はログ不要
}

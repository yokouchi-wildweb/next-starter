// src/features/core/user/services/server/creation/createFromRegistration.ts

import type { User } from "@/features/core/user/entities";
import type { UserProviderType } from "@/features/core/user/types";
import { GeneralUserSchema } from "@/features/core/user/entities/schema";
import { userService } from "@/features/core/user/services/server/userService";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";

export type CreateFromRegistrationInput = {
  providerType: UserProviderType;
  providerUid: string;
  email: string;
  displayName?: string | null;
  existingUser?: User | null;
};

export type CreateFromRegistrationResult = {
  user: User;
  isFromPending: boolean;
  isRejoin: boolean;
  isNewRegistration: boolean;
};

/**
 * 自発的登録（signup/OAuth）からユーザーを作成する。
 * - 認証情報の検証は auth ドメインで行う
 * - このサービスはユーザーの作成とログ記録のみを担当
 */
export async function createFromRegistration(
  input: CreateFromRegistrationInput,
): Promise<CreateFromRegistrationResult> {
  const { providerType, providerUid, email, displayName, existingUser } = input;

  const now = new Date();

  const validatedUserFields = await GeneralUserSchema.parseAsync({
    role: "user",
    status: "active",
    providerType,
    providerUid,
    localPassword: null,
    email,
    displayName: displayName ?? null,
    lastAuthenticatedAt: now,
  });

  // 状態遷移の判定
  const isFromPending = existingUser?.status === "pending";
  const isRejoin = existingUser?.status === "withdrawn";
  const isNewRegistration = !existingUser;

  const user = (await userService.upsert(
    {
      ...validatedUserFields,
      deletedAt: null,
    },
    { conflictFields: ["providerType", "providerUid"] },
  )) as User;

  // ユーザーアクションログを記録
  if (isFromPending) {
    // 本登録ログ（pending → active）
    await userActionLogService.create({
      targetUserId: user.id,
      actorId: user.id,
      actorType: "user",
      actionType: "user_register",
      beforeValue: { status: existingUser.status },
      afterValue: {
        status: user.status,
        email: user.email,
        displayName: user.displayName,
        providerType: user.providerType,
      },
      reason: null,
    });
  } else if (isRejoin) {
    // 再入会ログ（preRegistration を経由しない直接登録の場合）
    await userActionLogService.create({
      targetUserId: user.id,
      actorId: user.id,
      actorType: "user",
      actionType: "user_rejoin",
      beforeValue: { status: existingUser.status },
      afterValue: {
        status: user.status,
        email: user.email,
        displayName: user.displayName,
        providerType: user.providerType,
      },
      reason: null,
    });
  } else if (isNewRegistration) {
    // 新規登録ログ（preRegistration を経由しない直接登録の場合）
    await userActionLogService.create({
      targetUserId: user.id,
      actorId: user.id,
      actorType: "user",
      actionType: "user_register",
      beforeValue: null,
      afterValue: {
        status: user.status,
        email: user.email,
        displayName: user.displayName,
        providerType: user.providerType,
      },
      reason: null,
    });
  }

  return {
    user,
    isFromPending,
    isRejoin,
    isNewRegistration,
  };
}

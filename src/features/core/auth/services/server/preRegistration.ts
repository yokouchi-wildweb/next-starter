// src/features/auth/services/server/preRegistration.ts

import type { z } from "zod";

import { USER_REGISTERED_STATUSES } from "@/features/core/user/constants";
import { PreRegistrationSchema } from "@/features/core/auth/entities/schema";
import type { User } from "@/features/core/user/entities";
import { GeneralUserSchema } from "@/features/core/user/entities/schema";
import { userService } from "@/features/core/user/services/server/userService";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
import { DomainError } from "@/lib/errors";
import { getServerAuth } from "@/lib/firebase/server/app";

export type PreRegistrationInput = z.infer<typeof PreRegistrationSchema>;

export type PreRegistrationResult = {
  user: User;
};

export async function preRegister(input: unknown): Promise<PreRegistrationResult> {
  const parsedInput = PreRegistrationSchema.safeParse(input);

  if (!parsedInput.success) {
    throw new DomainError("登録に必要な情報が不足しています。", { status: 400 });
  }

  const { providerType, providerUid, idToken, email } = parsedInput.data;
  const emailFromRequest = email ?? undefined;

  const auth = getServerAuth();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch (error) {
    console.error("Failed to verify ID token in preRegister", error);
    throw new DomainError("認証情報の検証に失敗しました", { status: 401 });
  }

  if (!decoded?.uid) {
    throw new DomainError("プロバイダー UID を特定できませんでした", { status: 400 });
  }

  if (decoded.uid !== providerUid) {
    throw new DomainError("認証情報が一致しません", { status: 400 });
  }

  const emailFromToken = typeof decoded.email === "string" ? decoded.email.trim() : null;

  if (
    emailFromRequest &&
    emailFromToken &&
    emailFromRequest.toLowerCase() !== emailFromToken.toLowerCase()
  ) {
    throw new DomainError("メールアドレスが一致しません", { status: 400 });
  }

  const existingUser = await userService.findByProvider(providerType, providerUid);

  if (existingUser && USER_REGISTERED_STATUSES.includes(existingUser.status)) {
    throw new DomainError("このアカウントはすでに登録済みです", { status: 409 });
  }

  // 再入会かどうかを判定（withdrawn ステータスからの復帰）
  const isRejoin = existingUser?.status === "withdrawn";
  // 新規登録かどうかを判定（既存ユーザーがいない、または pending からの再実行でない）
  const isNewRegistration = !existingUser;

  const now = new Date();

  const emailToStore = emailFromRequest ?? null;

  const validatedUserFields = await GeneralUserSchema.parseAsync({
    role: "user",
    status: "pending",
    providerType,
    providerUid,
    localPassword: null,
    email: emailToStore,
    displayName: null,
    lastAuthenticatedAt: now,
  });

  const upserted = (await userService.upsert(
    validatedUserFields,
    { conflictFields: ["providerType", "providerUid"] },
  )) as User;

  // ユーザーアクションログを記録（新規登録または再入会の場合のみ）
  if (isRejoin) {
    // 再入会ログ
    await userActionLogService.create({
      targetUserId: upserted.id,
      actorId: upserted.id,
      actorType: "user",
      actionType: "user_rejoin",
      beforeValue: { status: existingUser.status },
      afterValue: {
        status: upserted.status,
        email: upserted.email,
        providerType: upserted.providerType,
      },
      reason: null,
    });
  } else if (isNewRegistration) {
    // 仮登録ログ
    await userActionLogService.create({
      targetUserId: upserted.id,
      actorId: upserted.id,
      actorType: "user",
      actionType: "user_preregister",
      beforeValue: null,
      afterValue: {
        status: upserted.status,
        email: upserted.email,
        providerType: upserted.providerType,
      },
      reason: null,
    });
  }
  // pending からの再実行の場合はログ不要

  return {
    user: upserted,
  };
}

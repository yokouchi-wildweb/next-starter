// src/features/auth/services/server/registration.ts

import type { z } from "zod";

import { USER_REGISTERED_STATUSES } from "@/features/core/user/constants";
import { RegistrationSchema } from "@/features/core/auth/entities";
import {
  SessionUserSchema,
  type SessionUser,
} from "@/features/core/auth/entities/session";
import type { User } from "@/features/core/user/entities";
import { GeneralUserSchema } from "@/features/core/user/entities/schema";
import { userService } from "@/features/core/user/services/server/userService";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
import { DomainError } from "@/lib/errors";
import { getServerAuth } from "@/lib/firebase/server/app";
import { signUserToken, SESSION_DEFAULT_MAX_AGE_SECONDS } from "@/lib/jwt";

export type RegistrationInput = z.infer<typeof RegistrationSchema>;

export type RegistrationResult = {
  user: User;
  sessionUser: SessionUser;
  session: {
    token: string;
    expiresAt: Date;
    maxAge: number;
  };
};

export async function register(input: unknown): Promise<RegistrationResult> {
  const parsedResult = RegistrationSchema.safeParse(input);

  if (!parsedResult.success) {
    throw new DomainError("本登録の入力内容が不正です。", { status: 400 });
  }

  const { providerType, providerUid, idToken, email, displayName, password } =
    parsedResult.data;

  const auth = getServerAuth();

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (error) {
    console.error("Failed to verify ID token in register", error);
    throw new DomainError("認証情報の検証に失敗しました", { status: 401 });
  }

  if (!decodedToken?.uid) {
    throw new DomainError("プロバイダー UID を特定できませんでした", { status: 400 });
  }

  if (decodedToken.uid !== providerUid) {
    throw new DomainError("認証情報が一致しません", { status: 400 });
  }

  const existingUser = await userService.findByProvider(providerType, providerUid);

  // ソフトデリート済みの場合は再登録不可
  if (existingUser?.deletedAt) {
    throw new DomainError(
      "このアカウントは登録できません。サービス管理者にお問い合わせください。",
      { status: 409 },
    );
  }

  if (existingUser && USER_REGISTERED_STATUSES.includes(existingUser.status)) {
    throw new DomainError("このアカウントはすでに本登録が完了しています", { status: 409 });
  }

  if (providerType === "email") {
    if (!password) {
      throw new DomainError("パスワード情報が不足しています", { status: 400 });
    }

    try {
      await auth.updateUser(providerUid, { password });
    } catch (error) {
      console.error("Failed to update Firebase password in register", error);
      throw new DomainError("パスワードの設定に失敗しました", { status: 500 });
    }
  }

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

  const upserted = (await userService.upsert(
    {
      ...validatedUserFields,
    },
    { conflictFields: ["providerType", "providerUid"] },
  )) as User;

  // ユーザーアクションログを記録
  if (isFromPending) {
    // 本登録ログ（pending → active）
    await userActionLogService.create({
      targetUserId: upserted.id,
      actorId: upserted.id,
      actorType: "user",
      actionType: "user_register",
      beforeValue: { status: existingUser.status },
      afterValue: {
        status: upserted.status,
        email: upserted.email,
        displayName: upserted.displayName,
        providerType: upserted.providerType,
      },
      reason: null,
    });
  } else if (isRejoin) {
    // 再入会ログ（preRegistration を経由しない直接登録の場合）
    await userActionLogService.create({
      targetUserId: upserted.id,
      actorId: upserted.id,
      actorType: "user",
      actionType: "user_rejoin",
      beforeValue: { status: existingUser.status },
      afterValue: {
        status: upserted.status,
        email: upserted.email,
        displayName: upserted.displayName,
        providerType: upserted.providerType,
      },
      reason: null,
    });
  } else if (isNewRegistration) {
    // 新規登録ログ（preRegistration を経由しない直接登録の場合）
    await userActionLogService.create({
      targetUserId: upserted.id,
      actorId: upserted.id,
      actorType: "user",
      actionType: "user_register",
      beforeValue: null,
      afterValue: {
        status: upserted.status,
        email: upserted.email,
        displayName: upserted.displayName,
        providerType: upserted.providerType,
      },
      reason: null,
    });
  }

  const sessionUser = SessionUserSchema.parse({
    userId: upserted.id,
    role: upserted.role,
    status: upserted.status,
    isDemo: upserted.isDemo,
    providerType: upserted.providerType,
    providerUid: upserted.providerUid,
    displayName: upserted.displayName,
  });

  const maxAge = SESSION_DEFAULT_MAX_AGE_SECONDS;
  const { token, expiresAt } = await signUserToken({
    subject: sessionUser.userId,
    claims: {
      role: sessionUser.role,
      status: sessionUser.status,
      isDemo: sessionUser.isDemo,
      providerType: sessionUser.providerType,
      providerUid: sessionUser.providerUid,
      displayName: sessionUser.displayName,
    },
    options: { maxAge },
  });

  return {
    user: upserted,
    sessionUser,
    session: {
      token,
      expiresAt,
      maxAge,
    },
  };
}


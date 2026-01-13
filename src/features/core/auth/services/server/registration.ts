// src/features/core/auth/services/server/registration.ts

import type { z } from "zod";

import { APP_FEATURES } from "@/config/app/app-features.config";
import {
  USER_REGISTERED_STATUSES,
  hasRoleProfile,
  type UserRoleType,
} from "@/features/core/user/constants";
import { RegistrationSchema } from "@/features/core/auth/entities";
import {
  SessionUserSchema,
  type SessionUser,
} from "@/features/core/auth/entities/session";
import type { User } from "@/features/core/user/entities";
import { userService } from "@/features/core/user/services/server/userService";
import { createFromRegistration } from "@/features/core/user/services/server/creation/createFromRegistration";
import { userProfileService } from "@/features/core/userProfile/services/server/userProfileService";
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

  const {
    providerType,
    providerUid,
    idToken,
    email,
    displayName,
    password,
    role: requestedRole,
    profileData,
  } = parsedResult.data;

  // ロールの決定（指定がない場合は設定のデフォルトを使用）
  const role = requestedRole ?? APP_FEATURES.registration.defaultRole;

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

  // ユーザー作成処理を user ドメインに委譲
  const { user } = await createFromRegistration({
    providerType,
    providerUid,
    email,
    displayName,
    existingUser,
    role,
  });

  // プロフィールを持つロールの場合、プロフィールデータを保存
  if (hasRoleProfile(role as UserRoleType) && profileData) {
    await userProfileService.upsertProfile(user.id, role as UserRoleType, profileData);
  }

  const sessionUser = SessionUserSchema.parse({
    userId: user.id,
    role: user.role,
    status: user.status,
    isDemo: user.isDemo,
    providerType: user.providerType,
    providerUid: user.providerUid,
    displayName: user.displayName,
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
    user,
    sessionUser,
    session: {
      token,
      expiresAt,
      maxAge,
    },
  };
}


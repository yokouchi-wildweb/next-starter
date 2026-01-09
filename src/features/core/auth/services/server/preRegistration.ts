// src/features/auth/services/server/preRegistration.ts

import type { z } from "zod";

import { USER_REGISTERED_STATUSES } from "@/constants/user";
import { PreRegistrationSchema } from "@/features/core/auth/entities/schema";
import type { User } from "@/features/core/user/entities";
import { GeneralUserSchema } from "@/features/core/user/entities/schema";
import { userService } from "@/features/core/user/services/server/userService";
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

  // ソフトデリート済みの場合は再登録不可
  if (existingUser?.deletedAt) {
    throw new DomainError(
      "このアカウントは登録できません。サービス管理者にお問い合わせください。",
      { status: 409 },
    );
  }

  if (existingUser && USER_REGISTERED_STATUSES.includes(existingUser.status)) {
    throw new DomainError("このアカウントはすでに登録済みです", { status: 409 });
  }

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
    {
      ...validatedUserFields,
    },
    { conflictFields: ["providerType", "providerUid"] },
  )) as User;

  return {
    user: upserted,
  };
}

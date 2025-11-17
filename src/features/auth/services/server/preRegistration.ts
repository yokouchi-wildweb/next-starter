// src/features/auth/services/server/preRegistration.ts

import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import { USER_REGISTERED_STATUSES } from "@/constants/user";
import { PreRegistrationSchema } from "@/features/auth/entities/schema";
import type { User } from "@/features/user/entities";
import { UserTable } from "@/features/user/entities/drizzle";
import { GeneralUserSchema } from "@/features/user/entities/schema";
import { userService } from "@/features/user/services/server/userService";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import { getServerAuth } from "@/lib/firebase/server/app";
import {
  SessionUserSchema,
  type SessionUser,
} from "@/features/auth/entities/session";
import { signUserToken, SESSION_DEFAULT_MAX_AGE_SECONDS } from "@/lib/jwt";

export type PreRegistrationInput = z.infer<typeof PreRegistrationSchema>;

export type PreRegistrationResult = {
  user: User;
  sessionUser: SessionUser;
  session: {
    token: string;
    expiresAt: Date;
    maxAge: number;
  };
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

  const existingUser = await db.query.UserTable.findFirst({
    where: and(eq(UserTable.providerType, providerType), eq(UserTable.providerUid, providerUid)),
  });

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

  const sessionUser = SessionUserSchema.parse({
    userId: upserted.id,
    role: upserted.role,
    status: upserted.status,
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

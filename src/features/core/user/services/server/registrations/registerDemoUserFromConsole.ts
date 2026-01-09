// src/features/user/services/server/registrations/registerDemoUserFromConsole.ts

import { randomUUID } from "crypto";

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { GeneralUserSchema } from "@/features/core/user/entities/schema";
import { DomainError } from "@/lib/errors";
import { hasFirebaseErrorCode } from "@/lib/firebase/errors";
import { getServerAuth } from "@/lib/firebase/server/app";
import { db } from "@/lib/drizzle";
import { assertEmailAvailability } from "@/features/core/user/services/server/helpers/assertEmailAvailability";
import type { CreateDemoUserInput } from "../../types";

/**
 * デモユーザーを登録する。
 * - admin: ローカル認証（providerType: "local"）
 * - user: Firebase メール認証（providerType: "email"）
 */
export async function registerDemoUserFromConsole(data: CreateDemoUserInput): Promise<User> {
  if (!data.email) {
    throw new DomainError("メールアドレスを入力してください");
  }

  if (data.role === "admin") {
    return registerDemoAdmin(data);
  }

  return registerDemoGeneralUser(data);
}

async function registerDemoAdmin(data: CreateDemoUserInput): Promise<User> {
  if (!data.localPassword || data.localPassword.length < 8) {
    throw new DomainError("パスワードは8文字以上で入力してください");
  }

  const normalizedEmail = await assertEmailAvailability({
    providerType: "local",
    email: data.email,
    errorMessage: "同じメールアドレスのユーザーが既に存在します",
  });

  const values = await GeneralUserSchema.parseAsync({
    role: "admin",
    status: "active",
    providerType: "local",
    providerUid: randomUUID(),
    localPassword: data.localPassword,
    email: normalizedEmail,
    displayName: data.displayName,
    isDemo: true,
  });

  const [user] = await db.insert(UserTable).values(values).returning();

  return user;
}

async function registerDemoGeneralUser(data: CreateDemoUserInput): Promise<User> {
  const auth = getServerAuth();

  // デモユーザー用の一時パスワードを生成
  const tempPassword = randomUUID();

  const firebaseUser = await (async () => {
    try {
      return await auth.createUser({
        email: data.email,
        password: tempPassword,
        displayName: data.displayName || undefined,
      });
    } catch (error) {
      if (hasFirebaseErrorCode(error, "auth/email-already-exists")) {
        throw new DomainError("同じメールアドレスのユーザーが既に存在します", { status: 409 });
      }
      throw error;
    }
  })();

  const values = await GeneralUserSchema.parseAsync({
    role: "user",
    status: "active",
    providerType: "email",
    providerUid: firebaseUser.uid,
    localPassword: null,
    email: data.email,
    displayName: data.displayName,
    isDemo: true,
  });

  const [user] = await db.insert(UserTable).values(values).returning();

  return user;
}

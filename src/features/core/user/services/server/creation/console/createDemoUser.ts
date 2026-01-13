// src/features/core/user/services/server/creation/console/createDemoUser.ts

import { randomUUID } from "crypto";

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { UserCoreSchema } from "@/features/core/user/entities/schema";
import {
  getRoleCategory,
  hasRoleProfile,
  type UserRoleType,
} from "@/features/core/user/constants/role";
import { DomainError } from "@/lib/errors";
import { hasFirebaseErrorCode } from "@/lib/firebase/errors";
import { getServerAuth } from "@/lib/firebase/server/app";
import { db } from "@/lib/drizzle";
import { assertEmailAvailability } from "@/features/core/user/services/server/helpers/assertEmailAvailability";
import { userProfileService } from "@/features/core/userProfile/services/server/userProfileService";
import type { CreateDemoUserInput } from "../../../types";

/**
 * デモユーザーを登録する。
 * - adminカテゴリ: ローカル認証（providerType: "local"）
 * - userカテゴリ: Firebase メール認証（providerType: "email"）
 */
export async function createDemoUser(data: CreateDemoUserInput): Promise<User> {
  if (!data.email) {
    throw new DomainError("メールアドレスを入力してください");
  }

  const role = data.role as UserRoleType;
  const category = getRoleCategory(role);

  // カテゴリに応じてユーザーを作成
  const user =
    category === "admin"
      ? await createDemoAdmin(data)
      : await createDemoGeneralUser(data);

  // プロフィールを持つロールの場合、プロフィールデータを保存
  if (hasRoleProfile(role) && data.profileData) {
    await userProfileService.upsertProfile(user.id, role, data.profileData);
  }

  return user;
}

async function createDemoAdmin(data: CreateDemoUserInput): Promise<User> {
  if (!data.localPassword || data.localPassword.length < 8) {
    throw new DomainError("パスワードは8文字以上で入力してください");
  }

  const normalizedEmail = await assertEmailAvailability({
    providerType: "local",
    email: data.email,
    errorMessage: "同じメールアドレスのユーザーが既に存在します",
  });

  const values = await UserCoreSchema.parseAsync({
    role: data.role,
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

async function createDemoGeneralUser(data: CreateDemoUserInput): Promise<User> {
  if (!data.localPassword || data.localPassword.length < 8) {
    throw new DomainError("パスワードは8文字以上で入力してください");
  }

  const auth = getServerAuth();

  const firebaseUser = await (async () => {
    try {
      return await auth.createUser({
        email: data.email,
        password: data.localPassword,
        displayName: data.displayName || undefined,
      });
    } catch (error) {
      if (hasFirebaseErrorCode(error, "auth/email-already-exists")) {
        throw new DomainError("同じメールアドレスのユーザーが既に存在します", { status: 409 });
      }
      throw error;
    }
  })();

  const values = await UserCoreSchema.parseAsync({
    role: data.role,
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

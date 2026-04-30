// src/features/core/user/services/server/creation/console/createGeneralUser.ts

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { UserCoreSchema } from "@/features/core/user/entities/schema";
import { auditLogger } from "@/features/core/auditLog";
import { DomainError } from "@/lib/errors";
import { hasFirebaseErrorCode } from "@/lib/firebase/errors";
import { getServerAuth } from "@/lib/firebase/server/app";
import { db } from "@/lib/drizzle";
import { findSoftDeletedUser } from "@/features/core/user/services/server/finders/findSoftDeletedUser";
import { assertRoleEnabled } from "@/features/core/user/utils/roleHelpers";
import { restoreSoftDeletedUser } from "./restore";

export type CreateGeneralUserInput = {
  name: string;
  email: string;
  localPassword: string;
  role?: string;
  [key: string]: unknown;
};

function validateInput(input: CreateGeneralUserInput): void {
  if (!input.email) {
    throw new DomainError("メールアドレスを入力してください");
  }

  if (!input.localPassword) {
    throw new DomainError("パスワードを入力してください");
  }
}

/**
 * 管理画面から一般ユーザーを作成する。
 * actor は AsyncLocalStorage 経由で routeFactory から自動注入される。
 */
export async function createGeneralUser(data: CreateGeneralUserInput): Promise<User> {
  validateInput(data);

  const role = data.role ?? "user";
  assertRoleEnabled(role);

  // ソフトデリート済みユーザーを検索（Firebase Auth チェック前に実行）
  const softDeletedUser = await findSoftDeletedUser({
    providerType: "email",
    email: data.email,
  });

  if (softDeletedUser) {
    return restoreSoftDeletedUser({
      existingUser: softDeletedUser,
      name: data.name,
      localPassword: data.localPassword,
      role,
    });
  }

  const auth = getServerAuth();

  const firebaseUser = await (async () => {
    try {
      return await auth.createUser({
        email: data.email,
        password: data.localPassword,
        displayName: data.name || undefined,
      });
    } catch (error) {
      if (hasFirebaseErrorCode(error, "auth/email-already-exists")) {
        throw new DomainError("同じメールアドレスのユーザーが既に存在します", { status: 409 });
      }
      throw error;
    }
  })();

  const values = await UserCoreSchema.parseAsync({
    role,
    status: "active",
    providerType: "email",
    providerUid: firebaseUser.uid,
    localPassword: null,
    email: data.email,
    name: data.name,
  });

  const [user] = await db.insert(UserTable).values(values).returning();

  await auditLogger.record({
    targetType: "user",
    targetId: user.id,
    action: "user.created_by_admin",
    before: null,
    after: {
      role: user.role,
      status: user.status,
      email: user.email,
      name: user.name,
      providerType: user.providerType,
    },
  });

  return user;
}

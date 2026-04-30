// src/features/core/user/services/server/creation/console/createAdmin.ts

import { randomUUID } from "crypto";

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { UserCoreSchema } from "@/features/core/user/entities/schema";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { DomainError } from "@/lib/errors";
import { db } from "@/lib/drizzle";
import { assertEmailAvailability } from "@/features/core/user/services/server/helpers/assertEmailAvailability";
import { findSoftDeletedUser } from "@/features/core/user/services/server/finders/findSoftDeletedUser";
import { assertRoleEnabled } from "@/features/core/user/utils/roleHelpers";
import { restoreSoftDeletedUser } from "./restore";

export type CreateAdminInput = {
  name: string;
  email: string;
  localPassword: string;
  role?: string;
  [key: string]: unknown;
};

function validateInput(input: CreateAdminInput): void {
  if (!input.email) {
    throw new DomainError("メールアドレスを入力してください");
  }

  if (!input.localPassword) {
    throw new DomainError("パスワードを入力してください");
  }
}

/**
 * 管理者ユーザーを作成する。
 * actor は AsyncLocalStorage 経由で routeFactory から自動注入される。
 */
export async function createAdmin(data: CreateAdminInput): Promise<User> {
  validateInput(data);

  const role = data.role ?? "admin";
  assertRoleEnabled(role);

  const softDeletedUser = await findSoftDeletedUser({
    providerType: "local",
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

  const normalizedEmail = await assertEmailAvailability({
    providerType: "local",
    email: data.email,
    errorMessage: "同じメールアドレスの管理者が既に存在します",
  });

  const values = await UserCoreSchema.parseAsync({
    role,
    status: "active",
    providerType: "local",
    providerUid: randomUUID(),
    localPassword: data.localPassword,
    email: normalizedEmail,
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

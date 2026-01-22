// src/features/core/user/services/server/creation/console/createAdmin.ts

import { randomUUID } from "crypto";

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { UserCoreSchema } from "@/features/core/user/entities/schema";
import { DomainError } from "@/lib/errors";
import { db } from "@/lib/drizzle";
import { assertEmailAvailability } from "@/features/core/user/services/server/helpers/assertEmailAvailability";
import { findSoftDeletedUser } from "@/features/core/user/services/server/finders/findSoftDeletedUser";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
import { assertRoleEnabled } from "@/features/core/user/utils/roleHelpers";
import { restoreSoftDeletedUser } from "./restore";

export type CreateAdminInput = {
  name: string;
  email: string;
  localPassword: string;
  role?: string;
  actorId?: string;
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

export async function createAdmin(data: CreateAdminInput): Promise<User> {
  validateInput(data);

  // ロールの有効性チェック
  const role = data.role ?? "admin";
  assertRoleEnabled(role);

  // ソフトデリート済みユーザーを検索
  const softDeletedUser = await findSoftDeletedUser({
    providerType: "local",
    email: data.email,
  });

  // ソフトデリート済みユーザーが存在する場合は復元処理
  if (softDeletedUser) {
    return restoreSoftDeletedUser({
      existingUser: softDeletedUser,
      name: data.name,
      localPassword: data.localPassword,
      role,
      actorId: data.actorId,
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

  // 操作者IDがある場合のみアクションログを記録
  if (data.actorId) {
    await userActionLogService.create({
      targetUserId: user.id,
      actorId: data.actorId,
      actorType: "admin",
      actionType: "admin_create_user",
      beforeValue: null,
      afterValue: {
        role: user.role,
        status: user.status,
        email: user.email,
        name: user.name,
        providerType: user.providerType,
      },
      reason: null,
    });
  }

  return user;
}

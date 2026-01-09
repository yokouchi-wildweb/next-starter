// src/features/core/user/services/server/creation/console/createAdmin.ts

import { randomUUID } from "crypto";

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { GeneralUserSchema } from "@/features/core/user/entities/schema";
import { DomainError } from "@/lib/errors";
import { db } from "@/lib/drizzle";
import { assertEmailAvailability } from "@/features/core/user/services/server/helpers/assertEmailAvailability";

export type CreateAdminInput = {
  displayName: string;
  email: string;
  localPassword: string;
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

  const normalizedEmail = await assertEmailAvailability({
    providerType: "local",
    email: data.email,
    errorMessage: "同じメールアドレスの管理者が既に存在します",
  });

  const values = await GeneralUserSchema.parseAsync({
    role: "admin",
    status: "active",
    providerType: "local",
    providerUid: randomUUID(),
    localPassword: data.localPassword,
    email: normalizedEmail,
    displayName: data.displayName,
  });

  const [user] = await db.insert(UserTable).values(values).returning();

  return user;
}

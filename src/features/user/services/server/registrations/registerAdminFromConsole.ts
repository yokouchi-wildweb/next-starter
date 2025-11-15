// src/features/user/services/server/registrations/registerAdminFromConsole.ts

import { and, eq } from "drizzle-orm";

import type { User } from "@/features/user/entities";
import { UserTable } from "@/features/user/entities/drizzle";
import { GeneralUserSchema } from "@/features/user/entities/schema";
import { DomainError } from "@/lib/errors";
import { db } from "@/lib/drizzle";

export type AdminConsoleRegistrationInput = {
  displayName: string;
  email: string;
  localPassword: string;
  [key: string]: unknown;
};

function validateInput(input: AdminConsoleRegistrationInput): void {
  if (!input.email) {
    throw new DomainError("メールアドレスを入力してください");
  }

  if (!input.localPassword) {
    throw new DomainError("パスワードを入力してください");
  }
}

async function assertLocalProviderAvailability(providerUid: string): Promise<void> {
  const existing = await db.query.UserTable.findFirst({
    where: and(eq(UserTable.providerType, "local"), eq(UserTable.providerUid, providerUid)),
  });

  if (existing) {
    throw new DomainError("同じ認証情報のユーザーが既に存在します", { status: 409 });
  }
}

export async function registerAdminFromConsole(
  data: AdminConsoleRegistrationInput,
): Promise<User> {
  validateInput(data);

  await assertLocalProviderAvailability(data.email);

  const values = await GeneralUserSchema.parseAsync({
    role: "admin",
    status: "active",
    providerType: "local",
    providerUid: data.email,
    localPassword: data.localPassword,
    email: data.email,
    displayName: data.displayName,
  });

  const [user] = await db.insert(UserTable).values(values).returning();

  return user;
}

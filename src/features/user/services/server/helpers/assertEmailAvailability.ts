// src/features/user/services/server/helpers/assertEmailAvailability.ts

import { and, eq } from "drizzle-orm";

import { UserTable } from "@/features/user/entities/drizzle";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import type { UserProviderType } from "@/types/user";

export type AssertEmailAvailabilityParams = {
  providerType: UserProviderType;
  email: string;
  errorMessage?: string;
};

/**
 * 指定したプロバイダー種別に同一メールが存在しないことを検証し、正規化したメールを返す。
 */
export async function assertEmailAvailability({
  providerType,
  email,
  errorMessage,
}: AssertEmailAvailabilityParams): Promise<string> {
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    throw new DomainError("メールアドレスを入力してください", { status: 400 });
  }

  const existing = await db.query.UserTable.findFirst({
    where: and(eq(UserTable.providerType, providerType), eq(UserTable.email, normalizedEmail)),
  });

  if (existing) {
    throw new DomainError(errorMessage ?? "同じメールアドレスのユーザーが既に存在します", { status: 409 });
  }

  return normalizedEmail;
}

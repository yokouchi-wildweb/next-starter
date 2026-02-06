// src/features/core/user/services/server/helpers/assertPhoneAvailability.ts

import { and, eq, isNull, ne } from "drizzle-orm";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";

export type AssertPhoneAvailabilityParams = {
  phoneNumber: string;
  excludeUserId?: string;
  errorMessage?: string;
};

/**
 * 指定した電話番号が他のユーザーに使用されていないことを検証する。
 * excludeUserId を指定した場合、そのユーザーは除外して検証する（自身の電話番号更新時用）。
 */
export async function assertPhoneAvailability({
  phoneNumber,
  excludeUserId,
  errorMessage,
}: AssertPhoneAvailabilityParams): Promise<void> {
  const conditions = [
    eq(UserTable.phoneNumber, phoneNumber),
    isNull(UserTable.deletedAt),
  ];

  if (excludeUserId) {
    conditions.push(ne(UserTable.id, excludeUserId));
  }

  const existing = await db.query.UserTable.findFirst({
    where: and(...conditions),
  });

  if (existing) {
    throw new DomainError(errorMessage ?? "この電話番号は既に使用されています", { status: 409 });
  }
}

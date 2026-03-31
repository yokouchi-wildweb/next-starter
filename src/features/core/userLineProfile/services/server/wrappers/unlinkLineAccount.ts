// src/features/userLineProfile/services/server/wrappers/unlinkLineAccount.ts

import { eq } from "drizzle-orm";

import { UserLineProfileTable } from "@/features/core/userLineProfile/entities/drizzle";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";

/**
 * ユーザーから LINE 連携を解除する。
 * user_line_profiles レコードを物理削除する。
 */
export async function unlinkLineAccount(userId: string): Promise<void> {
  const existing = await db.query.UserLineProfileTable.findFirst({
    where: eq(UserLineProfileTable.userId, userId),
  });

  if (!existing) {
    throw new DomainError("LINE 連携されていません", { status: 400 });
  }

  await db.delete(UserLineProfileTable).where(eq(UserLineProfileTable.id, existing.id));
}

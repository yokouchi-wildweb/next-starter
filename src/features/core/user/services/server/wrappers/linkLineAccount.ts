// src/features/user/services/server/wrappers/linkLineAccount.ts

import { and, eq, isNull } from "drizzle-orm";

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import { base } from "../drizzleBase";

/**
 * ユーザーに LINE userId を紐付ける。
 * 既に他のユーザーが同じ LINE userId で連携済みの場合はエラーをスローする。
 */
export async function linkLineAccount(
  userId: string,
  lineUserId: string,
): Promise<User> {
  // 同じ LINE userId が既に別ユーザーに紐付いていないか確認
  const existing = await db.query.UserTable.findFirst({
    where: and(
      eq(UserTable.lineUserId, lineUserId),
      isNull(UserTable.deletedAt),
    ),
  });

  if (existing) {
    if (existing.id === userId) {
      // 既に同じユーザーに紐付いている場合はそのまま返す
      return existing;
    }
    throw new DomainError("この LINE アカウントは既に別のユーザーに連携されています", { status: 409 });
  }

  return base.update(userId, { lineUserId } as Parameters<typeof base.update>[1]);
}

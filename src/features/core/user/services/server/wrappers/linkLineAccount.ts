// src/features/user/services/server/wrappers/linkLineAccount.ts

import { and, eq, isNull } from "drizzle-orm";

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import { base } from "../drizzleBase";

/** LINE連携時のプロフィール情報（任意） */
export type LinkLineAccountOptions = {
  displayName?: string;
  pictureUrl?: string;
};

/**
 * ユーザーに LINE userId を紐付ける。
 * 既に他のユーザーが同じ LINE userId で連携済みの場合はエラーをスローする。
 * displayName / pictureUrl が渡された場合は同時に保存する。
 */
export async function linkLineAccount(
  userId: string,
  lineUserId: string,
  options?: LinkLineAccountOptions,
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
      // 既に同じユーザーに紐付いている場合でもプロフィール情報は更新する
      if (options?.displayName !== undefined || options?.pictureUrl !== undefined) {
        return base.update(userId, {
          lineDisplayName: options.displayName ?? null,
          linePictureUrl: options.pictureUrl ?? null,
        } as Parameters<typeof base.update>[1]);
      }
      return existing;
    }
    throw new DomainError("この LINE アカウントは既に別のユーザーに連携されています", { status: 409 });
  }

  return base.update(userId, {
    lineUserId,
    lineDisplayName: options?.displayName ?? null,
    linePictureUrl: options?.pictureUrl ?? null,
  } as Parameters<typeof base.update>[1]);
}

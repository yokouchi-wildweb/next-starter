// src/features/userLineProfile/services/server/wrappers/linkLineAccount.ts

import { eq } from "drizzle-orm";

import type { UserLineProfile } from "@/features/core/userLineProfile/entities/model";
import { UserLineProfileTable } from "@/features/core/userLineProfile/entities/drizzle";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";

/** LINE連携時のプロフィール情報（任意） */
export type LinkLineAccountOptions = {
  displayName?: string;
  pictureUrl?: string;
};

/**
 * ユーザーに LINE userId を紐付ける。
 * 既に他のユーザーが同じ LINE userId で連携済みの場合はエラーをスローする。
 * 既に同じユーザーが連携済みの場合はプロフィール情報を更新する。
 */
export async function linkLineAccount(
  userId: string,
  lineUserId: string,
  options?: LinkLineAccountOptions,
): Promise<UserLineProfile> {
  // 同じ LINE userId が既に紐付いていないか確認
  const existingByLineId = await db.query.UserLineProfileTable.findFirst({
    where: eq(UserLineProfileTable.lineUserId, lineUserId),
  });

  if (existingByLineId) {
    if (existingByLineId.userId === userId) {
      // 既に同じユーザーに紐付いている場合はプロフィール情報を更新
      const [updated] = await db
        .update(UserLineProfileTable)
        .set({
          displayName: options?.displayName ?? null,
          pictureUrl: options?.pictureUrl ?? null,
        })
        .where(eq(UserLineProfileTable.id, existingByLineId.id))
        .returning();
      return updated;
    }
    throw new DomainError("この LINE アカウントは既に別のユーザーに連携されています", { status: 409 });
  }

  // 同じユーザーが既に別の LINE アカウントで連携していないか確認
  const existingByUserId = await db.query.UserLineProfileTable.findFirst({
    where: eq(UserLineProfileTable.userId, userId),
  });

  if (existingByUserId) {
    // 既存の連携を更新（LINE アカウントを切り替え）
    const [updated] = await db
      .update(UserLineProfileTable)
      .set({
        lineUserId,
        displayName: options?.displayName ?? null,
        pictureUrl: options?.pictureUrl ?? null,
      })
      .where(eq(UserLineProfileTable.id, existingByUserId.id))
      .returning();
    return updated;
  }

  // 新規作成
  const [created] = await db
    .insert(UserLineProfileTable)
    .values({
      userId,
      lineUserId,
      displayName: options?.displayName ?? null,
      pictureUrl: options?.pictureUrl ?? null,
    })
    .returning();
  return created;
}

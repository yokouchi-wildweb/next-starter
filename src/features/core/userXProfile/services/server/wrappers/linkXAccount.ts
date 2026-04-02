// src/features/userXProfile/services/server/wrappers/linkXAccount.ts

import { eq } from "drizzle-orm";

import type { UserXProfile } from "@/features/core/userXProfile/entities/model";
import { UserXProfileTable } from "@/features/core/userXProfile/entities/drizzle";
import { db } from "@/lib/drizzle";
import { encrypt } from "@/lib/crypto";
import { DomainError } from "@/lib/errors";

/** X 連携時のプロフィール・トークン情報 */
export type LinkXAccountOptions = {
  /** X ユーザーID */
  xUserId: string;
  /** @スクリーンネーム */
  username?: string;
  /** 表示名 */
  displayName?: string;
  /** プロフィール画像URL */
  profileImageUrl?: string;
  /** OAuth 2.0 アクセストークン（平文で渡す→内部で暗号化） */
  accessToken: string;
  /** OAuth 2.0 リフレッシュトークン（平文で渡す→内部で暗号化） */
  refreshToken: string;
  /** トークンの有効期限（Unix timestamp ミリ秒） */
  tokenExpiresAt: number;
  /** 認可済みスコープ */
  scopes?: string[];
};

/**
 * ユーザーに X アカウントを紐付ける。
 * トークンは暗号化して保存する。
 *
 * - 同じ X userId が他のユーザーに紐付いている場合 → 409 エラー
 * - 同じユーザーが既に同じ X アカウントで連携済み → プロフィール・トークン更新
 * - 同じユーザーが別の X アカウントで連携済み → 切り替え
 * - 未連携 → 新規作成
 */
export async function linkXAccount(
  userId: string,
  options: LinkXAccountOptions,
): Promise<UserXProfile> {
  const accessTokenEncrypted = encrypt(options.accessToken);
  const refreshTokenEncrypted = encrypt(options.refreshToken);
  const tokenExpiresAt = new Date(options.tokenExpiresAt);

  // 同じ X userId が既に紐付いていないか確認
  const existingByXId = await db.query.UserXProfileTable.findFirst({
    where: eq(UserXProfileTable.xUserId, options.xUserId),
  });

  if (existingByXId) {
    if (existingByXId.userId === userId) {
      // 既に同じユーザーに紐付いている場合はプロフィール・トークンを更新
      const [updated] = await db
        .update(UserXProfileTable)
        .set({
          username: options.username ?? null,
          displayName: options.displayName ?? null,
          profileImageUrl: options.profileImageUrl ?? null,
          accessTokenEncrypted,
          refreshTokenEncrypted,
          tokenExpiresAt,
          scopes: options.scopes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(UserXProfileTable.id, existingByXId.id))
        .returning();
      return updated;
    }
    throw new DomainError("この X アカウントは既に別のユーザーに連携されています", { status: 409 });
  }

  // 同じユーザーが既に別の X アカウントで連携していないか確認
  const existingByUserId = await db.query.UserXProfileTable.findFirst({
    where: eq(UserXProfileTable.userId, userId),
  });

  if (existingByUserId) {
    // 既存の連携を更新（X アカウントを切り替え）
    const [updated] = await db
      .update(UserXProfileTable)
      .set({
        xUserId: options.xUserId,
        username: options.username ?? null,
        displayName: options.displayName ?? null,
        profileImageUrl: options.profileImageUrl ?? null,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt,
        scopes: options.scopes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(UserXProfileTable.id, existingByUserId.id))
      .returning();
    return updated;
  }

  // 新規作成
  const [created] = await db
    .insert(UserXProfileTable)
    .values({
      userId,
      xUserId: options.xUserId,
      username: options.username ?? null,
      displayName: options.displayName ?? null,
      profileImageUrl: options.profileImageUrl ?? null,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokenExpiresAt,
      scopes: options.scopes ?? null,
    })
    .returning();
  return created;
}

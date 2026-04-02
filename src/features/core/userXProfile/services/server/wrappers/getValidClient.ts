// src/features/userXProfile/services/server/wrappers/getValidClient.ts

import { eq } from "drizzle-orm";
import type { TwitterApi } from "twitter-api-v2";

import type { UserXProfile } from "@/features/core/userXProfile/entities/model";
import { UserXProfileTable } from "@/features/core/userXProfile/entities/drizzle";
import { db } from "@/lib/drizzle";
import { encrypt, decrypt } from "@/lib/crypto";
import { getOrRefreshXClient } from "@/lib/x";
import { DomainError } from "@/lib/errors";

/**
 * ユーザーの X 連携プロフィールから有効なクライアントを取得する。
 * トークンが期限切れの場合は自動リフレッシュし、DBのトークンも更新する。
 *
 * @param userId - ユーザーID
 * @returns 認証済みクライアントとプロフィール情報
 * @throws X 連携されていない場合
 */
export async function getValidClient(
  userId: string,
): Promise<{ client: TwitterApi; profile: UserXProfile }> {
  const profile = await db.query.UserXProfileTable.findFirst({
    where: eq(UserXProfileTable.userId, userId),
  });

  if (!profile) {
    throw new DomainError("X 連携されていません", { status: 400 });
  }

  const accessToken = decrypt(profile.accessTokenEncrypted);
  const refreshToken = decrypt(profile.refreshTokenEncrypted);

  const { client, refreshed, tokens } = await getOrRefreshXClient({
    tokens: {
      accessToken,
      refreshToken,
      expiresAt: profile.tokenExpiresAt.getTime(),
    },
    onTokenRefreshed: async (newTokens) => {
      // トークンが更新された場合は暗号化して DB に保存
      await db
        .update(UserXProfileTable)
        .set({
          accessTokenEncrypted: encrypt(newTokens.accessToken),
          refreshTokenEncrypted: encrypt(newTokens.refreshToken),
          tokenExpiresAt: new Date(newTokens.expiresAt),
          updatedAt: new Date(),
        })
        .where(eq(UserXProfileTable.id, profile.id));
    },
  });

  // リフレッシュされた場合はプロフィールのトークン情報を最新に反映
  const currentProfile = refreshed
    ? {
        ...profile,
        accessTokenEncrypted: encrypt(tokens.accessToken),
        refreshTokenEncrypted: encrypt(tokens.refreshToken),
        tokenExpiresAt: new Date(tokens.expiresAt),
      }
    : profile;

  return { client, profile: currentProfile };
}

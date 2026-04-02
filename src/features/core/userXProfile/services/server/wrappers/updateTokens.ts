// src/features/userXProfile/services/server/wrappers/updateTokens.ts

import { eq } from "drizzle-orm";

import { UserXProfileTable } from "@/features/core/userXProfile/entities/drizzle";
import { db } from "@/lib/drizzle";
import { encrypt } from "@/lib/crypto";
import { DomainError } from "@/lib/errors";

/**
 * X 連携プロフィールのトークンを更新する。
 * リフレッシュ後のトークン保存に使用する。
 *
 * @param userId - ユーザーID
 * @param tokens - 新しいトークン情報（平文で渡す→内部で暗号化）
 */
export async function updateTokens(
  userId: string,
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  },
): Promise<void> {
  const existing = await db.query.UserXProfileTable.findFirst({
    where: eq(UserXProfileTable.userId, userId),
  });

  if (!existing) {
    throw new DomainError("X 連携されていません", { status: 400 });
  }

  await db
    .update(UserXProfileTable)
    .set({
      accessTokenEncrypted: encrypt(tokens.accessToken),
      refreshTokenEncrypted: encrypt(tokens.refreshToken),
      tokenExpiresAt: new Date(tokens.expiresAt),
      updatedAt: new Date(),
    })
    .where(eq(UserXProfileTable.id, existing.id));
}

// src/features/userXProfile/services/server/wrappers/unlinkXAccount.ts

import { eq } from "drizzle-orm";

import { UserXProfileTable } from "@/features/core/userXProfile/entities/drizzle";
import { db } from "@/lib/drizzle";
import { decrypt } from "@/lib/crypto";
import { revokeXToken } from "@/lib/x";
import { DomainError } from "@/lib/errors";

/**
 * ユーザーから X 連携を解除する。
 * X 側のトークンを revoke してからレコードを物理削除する。
 */
export async function unlinkXAccount(userId: string): Promise<void> {
  const existing = await db.query.UserXProfileTable.findFirst({
    where: eq(UserXProfileTable.userId, userId),
  });

  if (!existing) {
    throw new DomainError("X 連携されていません", { status: 400 });
  }

  // X 側のトークンを失効させる（エラーが出ても連携解除は続行）
  try {
    const accessToken = decrypt(existing.accessTokenEncrypted);
    await revokeXToken(accessToken);
  } catch {
    // トークンが既に無効な場合など。連携解除自体は続行する
  }

  await db.delete(UserXProfileTable).where(eq(UserXProfileTable.id, existing.id));
}

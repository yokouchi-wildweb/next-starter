// src/features/userXProfile/services/server/wrappers/unlinkXAccount.ts

import { eq } from "drizzle-orm";

import { UserXProfileTable } from "@/features/core/userXProfile/entities/drizzle";
import { auditLogger } from "@/features/core/auditLog/services/server";
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

  // 行は物理削除されるため、削除前のアカウント情報を before に残す（トークン列は含めない）。
  // 監査記録失敗時に削除だけ成立して痕跡が消えないよう、同一 tx で束ねる
  await db.transaction(async (trx) => {
    await trx.delete(UserXProfileTable).where(eq(UserXProfileTable.id, existing.id));

    await auditLogger.record({
      targetType: "user",
      targetId: userId,
      subjectUserId: userId,
      action: "user.x_profile.unlinked",
      before: {
        xUserId: existing.xUserId,
        username: existing.username,
        displayName: existing.displayName,
      },
      after: null,
      tx: trx,
    });
  });
}

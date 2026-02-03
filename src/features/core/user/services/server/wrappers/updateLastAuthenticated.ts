// src/features/user/services/server/wrappers/updateLastAuthenticated.ts

import { eq } from "drizzle-orm";

import { UserTable } from "@/features/core/user/entities/drizzle";
import type { UserMetadata, UserLoginRecord } from "@/features/core/user/entities/model";
import { db } from "@/lib/drizzle";

/** ログイン履歴の最大保持件数 */
const MAX_LOGIN_HISTORY = 3;

export type UpdateLastAuthenticatedOptions = {
  ip?: string;
};

/**
 * ユーザーの最終認証日時を更新する。
 * ログイン成功時に呼び出される。
 * IPアドレスが指定された場合はログイン履歴にも記録する。
 */
export async function updateLastAuthenticated(
  userId: string,
  options?: UpdateLastAuthenticatedOptions,
): Promise<void> {
  const now = new Date();

  if (options?.ip) {
    // 現在のmetadataを取得
    const user = await db
      .select({ metadata: UserTable.metadata })
      .from(UserTable)
      .where(eq(UserTable.id, userId))
      .then((rows) => rows[0]);

    const currentMetadata = (user?.metadata ?? {}) as UserMetadata;

    // 新しいログイン履歴を先頭に追加し、最大件数に制限
    const newRecord: UserLoginRecord = {
      ip: options.ip,
      at: now.toISOString(),
    };
    const newLoginHistory = [
      newRecord,
      ...(currentMetadata.loginHistory ?? []).slice(0, MAX_LOGIN_HISTORY - 1),
    ];

    await db
      .update(UserTable)
      .set({
        lastAuthenticatedAt: now,
        updatedAt: now,
        metadata: { ...currentMetadata, loginHistory: newLoginHistory },
      })
      .where(eq(UserTable.id, userId));
  } else {
    await db
      .update(UserTable)
      .set({ lastAuthenticatedAt: now, updatedAt: now })
      .where(eq(UserTable.id, userId));
  }
}

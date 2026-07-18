// src/features/user/services/server/wrappers/updateLastAuthenticated.ts

import { eq } from "drizzle-orm";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { MAX_LOGIN_HISTORY } from "@/features/core/user/entities/model";
import type { UserMetadata, UserLoginRecord } from "@/features/core/user/entities/model";
import { db } from "@/lib/drizzle";
import { recordLoginEvent } from "@/features/core/userLoginEvent/services/server";
import { base } from "../drizzleBase";

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
        // ログイン成功時はロックアウト関連カウンタを全クリア (詳細: lockoutPolicy.ts)
        failedLoginCount: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
      })
      .where(eq(UserTable.id, userId));
  } else {
    await db
      .update(UserTable)
      .set({
        lastAuthenticatedAt: now,
        updatedAt: now,
        failedLoginCount: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
      })
      .where(eq(UserTable.id, userId));
  }
  base.invalidateRequestMemo();

  // IP 横断検索用の正規化テーブル (user_login_events) にも記録する。
  // IP 未指定 / 書き込み失敗は recordLoginEvent 内でスキップ・握り潰される
  // (この経路でログインフローを阻害しないため)。
  await recordLoginEvent({
    userId,
    eventType: "login",
    ip: options?.ip,
    occurredAt: now,
  });
}

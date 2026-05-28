// src/features/core/auth/services/server/sessionInvalidation.ts

import { eq } from "drizzle-orm";

import { auditLogger } from "@/features/core/auditLog/services/server";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";
import { revokeAuthTokens } from "@/lib/firebase/server/authAdmin";

/**
 * 全セッション失効の発火理由 (監査ログ metadata.reason に格納される値)。
 *
 * - password_change: 本人 or 管理者によるパスワード変更
 * - status_ban: status=banned への遷移
 * - status_lock: status=security_locked への遷移 (連続失敗による自動 or 管理者手動)
 *
 * 追加する場合は SQL 集計クエリ・admin UI ラベルも同期して更新すること。
 */
export const SESSION_INVALIDATION_REASONS = [
  "password_change",
  "status_ban",
  "status_lock",
] as const;

export type SessionInvalidationReason =
  (typeof SESSION_INVALIDATION_REASONS)[number];

export type InvalidateSessionsForUserInput = {
  userId: string;
  /** Firebase Auth リフレッシュトークン revoke 用の UID。null/undefined ならスキップ */
  providerUid: string | null | undefined;
  reason: SessionInvalidationReason;
};

/**
 * 対象ユーザーの全セッションを失効させる。
 *
 * 動作:
 * 1. users.sessions_invalidated_at を now() に更新
 *    → resolveSessionUser が次回検証時に JWT.iat < sessions_invalidated_at で null を返す
 * 2. Firebase Auth の リフレッシュトークンを revoke (best-effort)
 *    → Firebase Storage 等の直接アクセスも遮断
 * 3. 監査ログ auth.session.invalidated を bestEffort で記録
 *
 * 呼び出し元: パスワード変更 (update wrapper) / status=banned,security_locked 遷移 (changeStatus wrapper)。
 */
export async function invalidateSessionsForUser({
  userId,
  providerUid,
  reason,
}: InvalidateSessionsForUserInput): Promise<void> {
  const now = new Date();

  // 1. DB の境界時刻を更新
  await db
    .update(UserTable)
    .set({ sessionsInvalidatedAt: now, updatedAt: now })
    .where(eq(UserTable.id, userId));

  // 2. Firebase 側のリフレッシュトークン revoke (best-effort)
  if (providerUid) {
    try {
      await revokeAuthTokens(providerUid);
    } catch (error) {
      // Firebase revoke 失敗は warn のみ。我々の JWT は (1) で失効済みなので
      // 認証フローの観点では十分に守られている。
      console.warn(
        "[sessionInvalidation] failed to revoke Firebase tokens",
        { userId, providerUid, reason },
        error,
      );
    }
  }

  // 3. 監査ログ
  await auditLogger.record({
    targetType: "user",
    targetId: userId,
    subjectUserId: userId,
    action: "auth.session.invalidated",
    metadata: { reason },
    bestEffort: true,
  });
}

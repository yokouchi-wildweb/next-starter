// src/features/core/auth/services/server/loginAudit.ts

import { auditLogger } from "@/features/core/auditLog/services/server";
import type { LoginFailureReason } from "@/features/core/auth/constants/loginFailure";
import { hashEmailForAudit } from "@/features/core/auth/utils/hashEmail";
import type { User } from "@/features/core/user/entities";

/** ログイン失敗イベントの監査保持期間 (日) */
const LOGIN_FAILURE_RETENTION_DAYS = 90;

export type RecordLoginFailureInput = {
  /** ユーザーが特定できた場合は対象 User、未特定 (user_not_found 等) は null */
  user: User | null;
  /** 試行された email (正規化前)。user 未特定時は metadata に保存 */
  email: string;
  /** 失敗理由 */
  reason: LoginFailureReason;
};

/**
 * ログイン失敗を audit_logs に記録する。
 *
 * - 既知ユーザー: targetId = user.id, metadata = { reason }
 * - 不明ユーザー: targetId = "unknown:<email_hash>",
 *                metadata = { reason, attemptedEmail }
 *
 * bestEffort: true で記録するため、audit インフラ障害でログインフローを
 * ブロックしない (失敗時は dead-letter テーブルに退避)。
 *
 * IP / userAgent / requestId は createApiRoute の ALS から自動注入される。
 */
export async function recordLoginFailure({
  user,
  email,
  reason,
}: RecordLoginFailureInput): Promise<void> {
  const targetId = user ? user.id : `unknown:${hashEmailForAudit(email)}`;
  const metadata: Record<string, unknown> = { reason };
  if (!user) {
    metadata.attemptedEmail = email;
  }

  await auditLogger.record({
    targetType: "user",
    targetId,
    // 既知ユーザーへの失敗試行はそのユーザーの subject に紐付ける。
    // 不明 email への試行は対象ユーザーが特定できないため null（攻撃検知用 unknown:<hash> として
    // targetId にのみ残し、ユーザー単位タイムラインには出さない）。
    subjectUserId: user?.id ?? null,
    action: "auth.login.failed",
    metadata,
    defaultRetentionDays: LOGIN_FAILURE_RETENTION_DAYS,
    bestEffort: true,
  });
}

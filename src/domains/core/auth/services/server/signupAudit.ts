// src/domains/core/auth/services/server/signupAudit.ts

import { auditLogger } from "@/domains/core/auditLog/services/server";
import type { SignupFailureFlow, SignupFailureReason } from "@/domains/core/auth/constants/signupFailure";
import { hashEmailForAudit } from "@/domains/core/auth/utils/hashEmail";
import type { User } from "@/domains/core/user/entities";

/** 登録まわりの失敗の監査保持期間(日)。ログインの失敗(loginAudit)と同じ */
const SIGNUP_FAILURE_RETENTION_DAYS = 90;

export type RecordSignupFailureInput = {
  /** 流れ(メールリンク・先行登録リンク・本登録・パスワード再設定) */
  flow: SignupFailureFlow;
  /** 失敗の理由 */
  reason: SignupFailureReason;
  /** 試された email(正規化前)。取れなかった時は null */
  email: string | null;
  /** ユーザーが特定できた時は対象の User、未特定は null(省略 = null) */
  user?: User | null;
};

/**
 * 登録まわりの失敗を audit_logs に記録する(loginAudit.recordLoginFailure と同じ形と個人情報の方針)。
 *
 * - action: password_reset は auth.passwordReset.failed、ほかは auth.signup.failed
 * - 既知ユーザー: targetId = user.id, subjectUserId = user.id, metadata = { flow, reason }
 * - 不明ユーザー: targetId = "unknown:<email_hash>"(email が無ければ "unknown:none"), subjectUserId = null,
 *                metadata = { flow, reason, attemptedEmail }(attemptedEmail は email がある時だけ)
 *
 * bestEffort: true で記録するため、audit の障害で登録の流れを止めない(失敗は dead-letter の表に退避)。
 * 黙った止め(使い捨てメール・Hide My Email)を記録しても、呼び手は利用者への答えを変えない。
 * IP / userAgent / requestId は createApiRoute の ALS から自動で入る。
 */
export async function recordSignupFailure({ flow, reason, email, user = null }: RecordSignupFailureInput): Promise<void> {
  const targetId = user ? user.id : `unknown:${email ? hashEmailForAudit(email) : "none"}`;
  const metadata: Record<string, unknown> = { flow, reason };
  if (!user && email) {
    metadata.attemptedEmail = email;
  }

  await auditLogger.record({
    targetType: "user",
    targetId,
    subjectUserId: user?.id ?? null,
    action: flow === "password_reset" ? "auth.passwordReset.failed" : "auth.signup.failed",
    metadata,
    defaultRetentionDays: SIGNUP_FAILURE_RETENTION_DAYS,
    bestEffort: true,
  });
}

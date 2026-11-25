// src/domains/core/auth/services/server/signupAudit.ts

import type { NextRequest } from "next/server";

import { auditLogger } from "@/domains/core/auditLog/services/server";
import type { SignupFailureFlow, SignupFailureReason } from "@/domains/core/auth/constants/signupFailure";
import { hashEmailForAudit } from "@/domains/core/auth/utils/hashEmail";
import { RATE_LIMIT_CONFIG, type RateLimitCategory } from "@/domains/core/rateLimit/config";
import { consumeRateLimit } from "@/domains/core/rateLimit/services/server";
import type { User } from "@/domains/core/user/entities";
import type { RouteRejection } from "@/lib/routeFactory";

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
  /** 理由の添え(reCAPTCHA の版・誤り・点数など。個人情報は入れない) */
  detail?: Record<string, string | number>;
};

/**
 * 登録まわりの失敗を audit_logs に記録する(loginAudit.recordLoginFailure と同じ形と個人情報の方針)。
 *
 * - action: password_reset は auth.password_reset.failed、ほかは auth.signup.failed
 * - 既知ユーザー: targetId = user.id, subjectUserId = user.id, metadata = { flow, reason }
 * - 不明ユーザー: targetId = "unknown:<email_hash>"(email が無ければ "unknown:none"), subjectUserId = null,
 *                metadata = { flow, reason, attemptedEmail }(attemptedEmail は email がある時だけ)
 *
 * bestEffort: true で記録するため、audit の障害で登録の流れを止めない(失敗は dead-letter の表に退避)。
 * 黙った止め(使い捨てメール・Hide My Email)を記録しても、呼び手は利用者への答えを変えない。
 * IP / userAgent / requestId は createApiRoute の ALS から自動で入る。
 */
export async function recordSignupFailure({ flow, reason, email, user = null, detail }: RecordSignupFailureInput): Promise<void> {
  const targetId = user ? user.id : `unknown:${email ? hashEmailForAudit(email) : "none"}`;
  const metadata: Record<string, unknown> = { ...detail, flow, reason };
  if (!user && email) {
    metadata.attemptedEmail = email;
  }

  // action は lint(audit/action-naming・subject-required)が字面で読むので、分かれ道ごとにリテラルで書く
  if (flow === "password_reset") {
    await auditLogger.record({
      targetType: "user",
      targetId,
      subjectUserId: user?.id ?? null,
      action: "auth.password_reset.failed",
      metadata,
      defaultRetentionDays: SIGNUP_FAILURE_RETENTION_DAYS,
      bestEffort: true,
    });
    return;
  }
  await auditLogger.record({
    targetType: "user",
    targetId,
    subjectUserId: user?.id ?? null,
    action: "auth.signup.failed",
    metadata,
    defaultRetentionDays: SIGNUP_FAILURE_RETENTION_DAYS,
    bestEffort: true,
  });
}

/** 429 の記録を区切りごとに 1 回にする鍵の scope(rateLimit の scope の形 "<地区>.<名前>") */
const REJECTION_AUDIT_SCOPE = "auth.signupRejectionAudit";

/** 本文の email を読めれば返す(断った時点では本文はまだ読まれていない。読めなければ null) */
async function emailOf(req: NextRequest): Promise<string | null> {
  try {
    const body: unknown = await req.clone().json();
    const email = typeof body === "object" && body !== null ? (body as { email?: unknown }).email : undefined;
    return typeof email === "string" ? email : null;
  } catch {
    return null;
  }
}

/**
 * ルートの Factory が断った時(createApiRoute の onRejected)に登録の失敗として記録する口。登録の API が
 * `onRejected: signupRejectionRecorder("<流れ>")` で渡す。
 *
 * - 回数制限(429): spam で同じ鍵が断られ続けても、そのカテゴリーの区切り(windowSeconds)ごとに最初の 1 回だけ書く。
 *   断った要求は回数制限に数えられないので、別の鍵(scope auth.signupRejectionAudit、上限 1)を consumeRateLimit で数える
 * - reCAPTCHA(403 / 428): 回数制限の後なので数はもう抑えられている。版・誤り・点数を添える
 */
export function signupRejectionRecorder(flow: SignupFailureFlow) {
  return async (rejection: RouteRejection<RateLimitCategory>, req: NextRequest): Promise<void> => {
    if (rejection.kind === "rateLimit") {
      const first = await consumeRateLimit({
        key: { scope: REJECTION_AUDIT_SCOPE, identifier: `${rejection.category}:${rejection.identifier}` },
        rule: { window: "fixed", windowSeconds: RATE_LIMIT_CONFIG[rejection.category].windowSeconds, limit: 1 },
      });
      if (!first.allowed) return;
      await recordSignupFailure({
        flow,
        reason: rejection.scope === "ip" ? "rate_limited_ip" : "rate_limited_subnet",
        email: await emailOf(req),
        detail: { category: rejection.category },
      });
      return;
    }
    const detail: Record<string, string | number> = { version: rejection.version };
    if (rejection.error) detail.error = rejection.error;
    if (rejection.score !== undefined) detail.score = rejection.score;
    await recordSignupFailure({
      flow,
      reason: rejection.outcome === "challenge" ? "recaptcha_challenge" : "recaptcha_failed",
      email: await emailOf(req),
      detail,
    });
  };
}

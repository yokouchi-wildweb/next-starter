// src/domains/core/rateLimit/services/server/wrappers/judgmentRateLimit.ts
//
// 銀行振込画像の AI 判定 API 専用のレート制限ヘルパー。
//
// 2軸の制限:
// - 直近15分: 失敗回数 3 を超えるとブロック（成功はカウントしない）
// - 直近24時間: 試行回数 30 を超えるとブロック（成功・失敗いずれもカウント）
//
// checkRateLimit(カテゴリで事前判定 + 足すを一体にする)を使わず、consumeRateLimit / peekRateLimit を直に使う理由:
// 1. 「成功時はカウントしない 15分カウンタ」「成功・失敗両方カウントする 24時間カウンタ」という
//    非対称な運用が必要(読むのは peek、足すのは consume)
// 2. 上限はカテゴリでなくこの 2 つの定数(LIMIT_*)で、窓もカテゴリの設定から外す
// 鍵の scope は rateLimit.judgeFail15m / rateLimit.judgeAttempt24h(固定の窓、行 id = <scope>:<userId>)
//
// 識別子は userId 固定。IP ベースだと共有環境で正規ユーザーが巻き添えになるため、
// ログイン後 API である本用途には不向き。

import { consumeRateLimit, peekRateLimit } from "../rateLimit";
import type { RateLimitWindowRule } from "../consume";

/** 15分ウィンドウで許可する失敗回数の上限（これを超えると次の試行はブロック）。 */
export const LIMIT_15M_FAILURES = 3;
/** 24時間ウィンドウで許可する試行回数の上限（成功・失敗の合算）。 */
export const LIMIT_24H_ATTEMPTS = 30;

const WINDOW_15M_SEC = 15 * 60;
const WINDOW_24H_SEC = 24 * 60 * 60;

const SCOPE_15M = "rateLimit.judgeFail15m";
const SCOPE_24H = "rateLimit.judgeAttempt24h";

const RULE_15M: RateLimitWindowRule = { window: "fixed", windowSeconds: WINDOW_15M_SEC, limit: LIMIT_15M_FAILURES };
const RULE_24H: RateLimitWindowRule = { window: "fixed", windowSeconds: WINDOW_24H_SEC, limit: LIMIT_24H_ATTEMPTS };

export type JudgmentRateLimitStatus = {
  /** 直近15分間の失敗回数 */
  failureCount15m: number;
  /** 直近24時間の試行回数（成功・失敗合算） */
  attemptCount24h: number;
  /** 15分ウィンドウの残り失敗許容回数 */
  remainingFailures15m: number;
  /** 24時間ウィンドウの残り試行可能回数 */
  remainingAttempts24h: number;
  /** 15分ウィンドウのリセット日時。レコード未作成時は null */
  resetAt15m: Date | null;
  /** 24時間ウィンドウのリセット日時。レコード未作成時は null */
  resetAt24h: Date | null;
};

export type JudgmentRateLimitCheck =
  | { ok: true; status: JudgmentRateLimitStatus }
  | {
      ok: false;
      /** どちらのウィンドウで上限に達したか。両方該当時は 24h を優先（より長いブロックを伝える）。 */
      blockedBy: "fifteenMin" | "daily";
      /** ブロック解除時刻 */
      resetAt: Date;
      status: JudgmentRateLimitStatus;
    };

/**
 * 現在の状況を読み取り、判定実行が許可されるかを返す（カウントは増やさない）。
 */
export async function checkJudgmentRateLimit(
  userId: string,
): Promise<JudgmentRateLimitCheck> {
  const status = await readStatus(userId);

  // 24時間優先: 長いブロックの方をユーザーに伝える
  if (status.attemptCount24h >= LIMIT_24H_ATTEMPTS && status.resetAt24h) {
    return {
      ok: false,
      blockedBy: "daily",
      resetAt: status.resetAt24h,
      status,
    };
  }
  if (status.failureCount15m >= LIMIT_15M_FAILURES && status.resetAt15m) {
    return {
      ok: false,
      blockedBy: "fifteenMin",
      resetAt: status.resetAt15m,
      status,
    };
  }
  return { ok: true, status };
}

/** 判定試行を記録（24時間カウンタを +1）。成功・失敗のいずれでも呼ぶ。 */
export async function recordAttempt(userId: string): Promise<void> {
  await consumeRateLimit({ key: { scope: SCOPE_24H, identifier: userId }, rule: RULE_24H });
}

/** 判定失敗を記録（15分カウンタを +1）。失敗時のみ呼ぶ。 */
export async function recordFailure(userId: string): Promise<void> {
  await consumeRateLimit({ key: { scope: SCOPE_15M, identifier: userId }, rule: RULE_15M });
}

/** 残量を含むステータスを取得（カウントは増やさない）。API レスポンス用。 */
export async function getJudgmentRateLimitStatus(
  userId: string,
): Promise<JudgmentRateLimitStatus> {
  return readStatus(userId);
}

// ============================================
// 内部ヘルパー
// ============================================

async function readStatus(userId: string): Promise<JudgmentRateLimitStatus> {
  const [rec15m, rec24h] = await Promise.all([
    peekRateLimit({ key: { scope: SCOPE_15M, identifier: userId }, rule: RULE_15M }),
    peekRateLimit({ key: { scope: SCOPE_24H, identifier: userId }, rule: RULE_24H }),
  ]);

  const failureCount15m = rec15m.count;
  const attemptCount24h = rec24h.count;

  return {
    failureCount15m,
    attemptCount24h,
    remainingFailures15m: Math.max(0, LIMIT_15M_FAILURES - failureCount15m),
    remainingAttempts24h: Math.max(0, LIMIT_24H_ATTEMPTS - attemptCount24h),
    // 窓の内の行が無い(回数 0)時は null(期限切れの行が残っていても見ない)
    resetAt15m: failureCount15m > 0 ? rec15m.resetAt : null,
    resetAt24h: attemptCount24h > 0 ? rec24h.resetAt : null,
  };
}

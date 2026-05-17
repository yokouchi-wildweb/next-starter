// src/features/core/rateLimit/services/server/wrappers/judgmentRateLimit.ts
//
// 銀行振込画像の AI 判定 API 専用のレート制限ヘルパー。
//
// 2軸の制限:
// - 直近15分: 失敗回数 3 を超えるとブロック（成功はカウントしない）
// - 直近24時間: 試行回数 30 を超えるとブロック（成功・失敗いずれもカウント）
//
// 既存 checkRateLimit を使わずに直接 RateLimitTable を操作する理由:
// 1. 「成功時はカウントしない 15分カウンタ」「成功・失敗両方カウントする 24時間カウンタ」という
//    非対称な運用が必要（checkRateLimit は事前判定 + インクリメントを一体化する単純インターフェース）
// 2. checkRateLimit は newCount >= maxRequests でブロックするため実際の許可回数が
//    maxRequests - 1 になる off-by-one を持つ。本ヘルパーは直接 count 比較で正確に動作する
//
// 識別子は userId 固定。IP ベースだと共有環境で正規ユーザーが巻き添えになるため、
// ログイン後 API である本用途には不向き。

import { eq, sql } from "drizzle-orm";

import { buildRateLimitKey } from "@/features/core/rateLimit/constants";
import { RateLimitTable } from "@/features/core/rateLimit/entities/drizzle";
import { db } from "@/lib/drizzle";

/** 15分ウィンドウで許可する失敗回数の上限（これを超えると次の試行はブロック）。 */
export const LIMIT_15M_FAILURES = 3;
/** 24時間ウィンドウで許可する試行回数の上限（成功・失敗の合算）。 */
export const LIMIT_24H_ATTEMPTS = 30;

const WINDOW_15M_SEC = 15 * 60;
const WINDOW_24H_SEC = 24 * 60 * 60;

const CATEGORY_15M = "bankTransferJudgeFail15m";
const CATEGORY_24H = "bankTransferJudgeAttempt24h";

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
  const now = new Date();
  await incrementCounter(CATEGORY_24H, userId, now, WINDOW_24H_SEC);
}

/** 判定失敗を記録（15分カウンタを +1）。失敗時のみ呼ぶ。 */
export async function recordFailure(userId: string): Promise<void> {
  const now = new Date();
  await incrementCounter(CATEGORY_15M, userId, now, WINDOW_15M_SEC);
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
  const now = new Date();
  const [rec15m, rec24h] = await Promise.all([
    fetchRecord(CATEGORY_15M, userId, now),
    fetchRecord(CATEGORY_24H, userId, now),
  ]);

  const failureCount15m = rec15m?.count ?? 0;
  const attemptCount24h = rec24h?.count ?? 0;

  return {
    failureCount15m,
    attemptCount24h,
    remainingFailures15m: Math.max(0, LIMIT_15M_FAILURES - failureCount15m),
    remainingAttempts24h: Math.max(0, LIMIT_24H_ATTEMPTS - attemptCount24h),
    resetAt15m: rec15m?.expires_at ?? null,
    resetAt24h: rec24h?.expires_at ?? null,
  };
}

/**
 * カテゴリ・ユーザーIDに対応する有効レコードを取得（期限切れは null 扱い）。
 * 期限切れレコードが残っていても無視するため、cron 削除が遅延しても安全。
 */
async function fetchRecord(category: string, userId: string, now: Date) {
  const key = buildRateLimitKey(category, userId);
  const rows = await db
    .select()
    .from(RateLimitTable)
    .where(eq(RateLimitTable.id, key))
    .limit(1);
  const record = rows[0];
  if (!record || record.expires_at <= now) {
    return null;
  }
  return record;
}

/**
 * カウンタを 1 増やす（既存ウィンドウ内なら count++、無効/期限切れなら新規ウィンドウで count=1）。
 *
 * 1クエリで完結させるため UPDATE ... WHERE expires_at > now を試み、
 * 影響行数 0 なら新規 INSERT/UPSERT。
 * race condition でも最終的に count が単調増加するので問題なし。
 */
async function incrementCounter(
  category: string,
  userId: string,
  now: Date,
  windowSeconds: number,
): Promise<void> {
  const key = buildRateLimitKey(category, userId);
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

  // 有効ウィンドウ内ならインクリメント
  const updated = await db
    .update(RateLimitTable)
    .set({ count: sql`${RateLimitTable.count} + 1` })
    .where(
      sql`${RateLimitTable.id} = ${key} AND ${RateLimitTable.expires_at} > ${now.toISOString()}`,
    )
    .returning({ id: RateLimitTable.id });

  if (updated.length > 0) return;

  // 新規 or 期限切れ: 新ウィンドウで count=1 から開始
  await db
    .insert(RateLimitTable)
    .values({
      id: key,
      count: 1,
      window_start: now,
      expires_at: expiresAt,
    })
    .onConflictDoUpdate({
      target: RateLimitTable.id,
      set: {
        count: 1,
        window_start: now,
        expires_at: expiresAt,
      },
    });
}

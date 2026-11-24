// src/domains/core/rateLimit/services/server/wrappers/rateLimitHelper.ts

import { lt } from "drizzle-orm";

import { RATE_LIMIT_CONFIG, type RateLimitCategory } from "@/domains/rateLimit/config";
import { RateLimitTable } from "@/domains/core/rateLimit/entities/drizzle";
import type { RateLimitResult } from "@/domains/core/rateLimit/constants";
import { db } from "@/lib/drizzle";

import { consumeRateLimit, peekRateLimit } from "../rateLimit";

/**
 * 今の数え方の上限: 窓の最初の 1 回は必ず通し、その後は count + 1 < maxRequests の間だけ通す
 * = maxRequests − 1 回(maxRequests ≤ 2 なら 1 回)。数えのずれ(D21)を 03-2 まで保つためだけの 1 行(D56)
 */
const legacyLimit = (maxRequests: number) => Math.max(1, maxRequests - 1);

/**
 * レート制限をチェックし、カウントを更新する(consumeRateLimit の上。名前・引数・戻り値・通す回数は今のまま)
 *
 * @param category - 制限カテゴリ（RATE_LIMIT_CONFIG のキー）
 * @param identifier - 識別子（IPアドレス、ユーザーIDなど）
 * @returns RateLimitResult - 許可/拒否の結果と残り回数(remaining = maxRequests − 今の回数、拒否は 0)
 *
 * @example
 * const result = await checkRateLimit("signup", request.ip);
 * if (!result.allowed) {
 *   return Response.json({ error: "制限超過" }, { status: 429 });
 * }
 */
export async function checkRateLimit(
  category: RateLimitCategory,
  identifier: string
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIG[category];
  const result = await consumeRateLimit({
    key: { scope: category, identifier },
    rule: { window: "fixed", windowSeconds: config.windowSeconds, limit: legacyLimit(config.maxRequests) },
  });
  return {
    allowed: result.allowed,
    remaining: result.allowed ? config.maxRequests - result.count : 0,
    resetAt: result.resetAt,
    count: result.count,
  };
}

/**
 * レート制限の現在状態を取得（カウントを増やさない、peekRateLimit の上）
 *
 * @param category - 制限カテゴリ
 * @param identifier - 識別子
 * @returns RateLimitResult | null - 制限情報、窓の内の行がなければnull
 */
export async function getRateLimitStatus(
  category: RateLimitCategory,
  identifier: string
): Promise<RateLimitResult | null> {
  const result = await peekRateLimit({ key: { scope: category, identifier }, rule: category });
  return result.count === 0 ? null : result;
}

/**
 * 期限切れのレート制限レコードを削除
 * Cron Jobなどで定期実行する
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const now = new Date();

  const result = await db
    .delete(RateLimitTable)
    .where(lt(RateLimitTable.expires_at, now));

  // Drizzleのdelete結果からrowCountを取得（PostgreSQLの場合）
  return (result as unknown as { rowCount: number }).rowCount ?? 0;
}

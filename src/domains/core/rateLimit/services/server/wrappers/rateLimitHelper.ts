// src/domains/core/rateLimit/services/server/wrappers/rateLimitHelper.ts

import type { RateLimitCategory } from "@/domains/rateLimit/config";
import type { RateLimitResult } from "@/domains/core/rateLimit/constants";

import { consumeRateLimit, peekRateLimit } from "../rateLimit";

/**
 * レート制限をチェックし、カウントを更新する(consumeRateLimit の上、カテゴリの規則で maxRequests 回まで通す)
 *
 * @param category - 制限カテゴリ（RATE_LIMIT_CONFIG のキー）
 * @param identifier - 識別子（IPアドレス、ユーザーIDなど）
 * @returns RateLimitResult - 許可/拒否の結果と残り回数(remaining = maxRequests − 今の回数)
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
  return consumeRateLimit({ key: { scope: category, identifier }, rule: category });
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

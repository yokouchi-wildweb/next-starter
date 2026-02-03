// src/features/core/rateLimit/services/server/wrappers/rateLimitHelper.ts

import { eq, lt } from "drizzle-orm";

import { RATE_LIMIT_CONFIG, type RateLimitCategory } from "@/config/app/rate-limit.config";
import { RateLimitTable } from "@/features/core/rateLimit/entities/drizzle";
import { buildRateLimitKey, type RateLimitResult } from "@/features/core/rateLimit/constants";
import { db } from "@/lib/drizzle";

/**
 * レート制限をチェックし、カウントを更新する
 *
 * @param category - 制限カテゴリ（RATE_LIMIT_CONFIG のキー）
 * @param identifier - 識別子（IPアドレス、ユーザーIDなど）
 * @returns RateLimitResult - 許可/拒否の結果と残り回数
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
  const key = buildRateLimitKey(category, identifier);
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowSeconds * 1000);
  const expiresAt = new Date(now.getTime() + config.windowSeconds * 1000);

  // 既存レコードを取得
  const existing = await db
    .select()
    .from(RateLimitTable)
    .where(eq(RateLimitTable.id, key))
    .limit(1);

  const record = existing[0];

  // レコードが存在し、ウィンドウ内の場合
  if (record && record.window_start > windowStart) {
    const newCount = record.count + 1;

    // 制限超過
    if (newCount > config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: record.expires_at,
        count: record.count,
      };
    }

    // カウント増加
    await db
      .update(RateLimitTable)
      .set({ count: newCount })
      .where(eq(RateLimitTable.id, key));

    return {
      allowed: true,
      remaining: config.maxRequests - newCount,
      resetAt: record.expires_at,
      count: newCount,
    };
  }

  // 新規作成または期限切れ: レコードをupsert
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

  return {
    allowed: true,
    remaining: config.maxRequests - 1,
    resetAt: expiresAt,
    count: 1,
  };
}

/**
 * レート制限の現在状態を取得（カウントを増やさない）
 *
 * @param category - 制限カテゴリ
 * @param identifier - 識別子
 * @returns RateLimitResult | null - 制限情報、レコードがなければnull
 */
export async function getRateLimitStatus(
  category: RateLimitCategory,
  identifier: string
): Promise<RateLimitResult | null> {
  const config = RATE_LIMIT_CONFIG[category];
  const key = buildRateLimitKey(category, identifier);
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowSeconds * 1000);

  const existing = await db
    .select()
    .from(RateLimitTable)
    .where(eq(RateLimitTable.id, key))
    .limit(1);

  const record = existing[0];

  if (!record || record.window_start <= windowStart) {
    return null;
  }

  return {
    allowed: record.count < config.maxRequests,
    remaining: Math.max(0, config.maxRequests - record.count),
    resetAt: record.expires_at,
    count: record.count,
  };
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

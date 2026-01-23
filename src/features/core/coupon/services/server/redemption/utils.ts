// クーポン redemption 共通ユーティリティ

import { db } from "@/lib/drizzle";
import { CouponTable } from "../../../entities/drizzle";
import type { Coupon } from "../../../entities/model";
import type { UsabilityReason } from "../../../types/redeem";
import { eq } from "drizzle-orm";

// トランザクション関連は共通モジュールから re-export
export type { TransactionClient } from "@/lib/drizzle/transaction";
export { runWithTransaction } from "@/lib/drizzle/transaction";

import type { TransactionClient } from "@/lib/drizzle/transaction";

/**
 * 静的バリデーション結果の型
 * DB アクセスなしで判定できる項目のみ
 */
export type StaticValidationResult =
  | { valid: true }
  | { valid: false; reason: Exclude<UsabilityReason, "not_found" | "max_per_user_reached"> };

/**
 * コードからクーポンを取得
 */
export async function getCouponByCode(
  code: string,
  tx?: TransactionClient,
  options?: { lock?: boolean }
): Promise<Coupon | null> {
  const executor = tx ?? db;
  const query = executor
    .select()
    .from(CouponTable)
    .where(eq(CouponTable.code, code))
    .limit(1);

  const rows = options?.lock ? await query.for("update") : await query;
  return (rows[0] as Coupon | undefined) ?? null;
}

/**
 * IDからクーポンを取得
 */
export async function getCouponById(
  id: string,
  tx?: TransactionClient,
  options?: { lock?: boolean }
): Promise<Coupon | null> {
  const executor = tx ?? db;
  const query = executor
    .select()
    .from(CouponTable)
    .where(eq(CouponTable.id, id))
    .limit(1);

  const rows = options?.lock ? await query.for("update") : await query;
  return (rows[0] as Coupon | undefined) ?? null;
}

/**
 * クーポンの静的バリデーション（DB アクセス不要な項目のみ）
 *
 * チェック項目:
 * - status === 'active'
 * - valid_from <= now（設定時）
 * - valid_until >= now（設定時）
 * - current_total_uses < max_total_uses（設定時）
 * - max_uses_per_redeemer 設定時は userId 必須
 *
 * チェックしない項目（DB アクセス必要）:
 * - not_found（クーポン取得は呼び出し側で行う）
 * - max_per_user_reached（couponHistory へのクエリが必要）
 */
export function validateCouponStatically(
  coupon: Coupon,
  redeemerUserId?: string | null
): StaticValidationResult {
  // ステータスチェック
  if (coupon.status !== "active") {
    return { valid: false, reason: "inactive" };
  }

  const now = new Date();

  // 開始日チェック
  if (coupon.valid_from && coupon.valid_from > now) {
    return { valid: false, reason: "not_started" };
  }

  // 終了日チェック
  if (coupon.valid_until && coupon.valid_until < now) {
    return { valid: false, reason: "expired" };
  }

  // 総使用回数上限チェック
  if (
    coupon.max_total_uses !== null &&
    coupon.current_total_uses >= coupon.max_total_uses
  ) {
    return { valid: false, reason: "max_total_reached" };
  }

  // ユーザー毎の使用回数上限が設定されている場合、userId 必須
  if (coupon.max_uses_per_redeemer !== null && !redeemerUserId) {
    return { valid: false, reason: "user_id_required" };
  }

  return { valid: true };
}

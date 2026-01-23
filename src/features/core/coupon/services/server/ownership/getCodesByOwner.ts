// 指定ユーザーが所有するクーポン一覧を取得

import { db } from "@/lib/drizzle";
import { CouponTable } from "../../../entities/drizzle";
import type { Coupon } from "../../../entities/model";
import { and, eq, isNull } from "drizzle-orm";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import type { CouponTypeWithOwner } from "./issueCodeForOwner";

export type GetCodesByOwnerParams = {
  attributionUserId: string;
  type?: CouponTypeWithOwner;
  includeInactive?: boolean;
  includeDeleted?: boolean;
};

/**
 * 指定ユーザーが所有するクーポン一覧を取得
 *
 * @param params 取得パラメータ
 * @param tx 外部トランザクション（オプション）
 */
export async function getCodesByOwner(
  params: GetCodesByOwnerParams,
  tx?: TransactionClient
): Promise<Coupon[]> {
  const executor = tx ?? db;

  const conditions = [eq(CouponTable.attribution_user_id, params.attributionUserId)];

  // タイプフィルタ
  if (params.type) {
    conditions.push(eq(CouponTable.type, params.type));
  }

  // ステータスフィルタ（デフォルト: active のみ）
  if (!params.includeInactive) {
    conditions.push(eq(CouponTable.status, "active"));
  }

  // ソフトデリートフィルタ（デフォルト: 削除済み除外）
  if (!params.includeDeleted) {
    conditions.push(isNull(CouponTable.deletedAt));
  }

  const rows = await executor
    .select()
    .from(CouponTable)
    .where(and(...conditions))
    .orderBy(CouponTable.createdAt);

  return rows as Coupon[];
}

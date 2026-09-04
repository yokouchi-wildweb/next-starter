// 指定ユーザーが所有するクーポン一覧を取得

import { db } from "@/lib/drizzle";
import { CouponTable } from "../../../entities/drizzle";
import type { Coupon } from "../../../entities/model";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import type { CouponTypeWithOwner } from "./issueCodeForOwner";

export type GetCodesByOwnerParams = {
  attributionUserId: string;
  type?: CouponTypeWithOwner;
  includeInactive?: boolean;
  includeDeleted?: boolean;
  /** 取得件数上限（省略時は全件。周期発行など件数が増える用途では必ず指定する） */
  limit?: number;
  /** createdAt の並び順（既定 asc） */
  order?: "asc" | "desc";
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

  const orderBy = params.order === "desc" ? desc(CouponTable.createdAt) : asc(CouponTable.createdAt);
  const query = executor
    .select()
    .from(CouponTable)
    .where(and(...conditions))
    .orderBy(orderBy);

  const rows = params.limit ? await query.limit(params.limit) : await query;

  return rows as Coupon[];
}

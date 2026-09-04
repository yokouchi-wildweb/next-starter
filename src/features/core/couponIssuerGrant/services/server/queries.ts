// src/features/core/couponIssuerGrant/services/server/queries.ts

import { eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { DomainError } from "@/lib/errors/domainError";
import { CouponIssuerGrantTable } from "@/features/core/couponIssuerGrant/entities/drizzle";
import type { CouponIssuerGrant } from "@/features/core/couponIssuerGrant/entities/model";

/** ユーザーの発行権を取得（未申請なら null） */
export async function getGrantByUser(
  userId: string,
  tx?: TransactionClient,
  options?: { lock?: boolean },
): Promise<CouponIssuerGrant | null> {
  const executor = tx ?? db;
  const query = executor
    .select()
    .from(CouponIssuerGrantTable)
    .where(eq(CouponIssuerGrantTable.user_id, userId))
    .limit(1);
  const rows = options?.lock ? await query.for("update") : await query;
  return (rows[0] as CouponIssuerGrant | undefined) ?? null;
}

/** ID で発行権を行ロック付き取得（状態遷移用）。存在しなければ 404 */
export async function requireGrantForUpdate(
  grantId: string,
  tx: TransactionClient,
): Promise<CouponIssuerGrant> {
  const [row] = await tx
    .select()
    .from(CouponIssuerGrantTable)
    .where(eq(CouponIssuerGrantTable.id, grantId))
    .for("update");
  if (!row) {
    throw new DomainError("発行権が見つかりません", { status: 404 });
  }
  return row as CouponIssuerGrant;
}

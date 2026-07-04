// src/features/core/wallet/services/server/lots/getExpiringLots.ts
// 失効間近残高の照会（ユーザー向け失効予告・通知バッチ用のデータレイヤ）
//
// UI・通知の文言/画面はダウンストリーム所有。ここはデータ提供のみ。

import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { WalletTable, WalletLotTable } from "@/features/core/wallet/entities/drizzle";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import { isExpirationEnabled } from "@/features/core/wallet/utils/expiration";
import type {
  ExpiringLotsSummary,
  UserExpiringAmount,
} from "@/features/core/wallet/services/types";

/**
 * 指定ユーザー・通貨の失効間近ロットを失効日ごとに集約して返す。
 *
 * - 対象: remaining > 0 かつ 現在〜withinDays 日以内に失効するロット
 * - 期限切れ済み（未スイープ）のロットは「もう失効した扱い」のため含めない
 * - 有効期限が無効な walletType では常に空を返す
 */
export async function getExpiringLots(
  userId: string,
  walletType: WalletTypeValue,
  withinDays: number,
): Promise<ExpiringLotsSummary> {
  if (!isExpirationEnabled(walletType) || withinDays <= 0) {
    return { lots: [], totalExpiring: 0 };
  }

  const rows = await db
    .select({
      expiresAt: WalletLotTable.expires_at,
      amount: sql<number>`SUM(${WalletLotTable.remaining})::int`,
    })
    .from(WalletLotTable)
    .innerJoin(WalletTable, eq(WalletLotTable.wallet_id, WalletTable.id))
    .where(
      and(
        eq(WalletTable.user_id, userId),
        eq(WalletTable.type, walletType),
        gt(WalletLotTable.remaining, 0),
        sql`${WalletLotTable.expires_at} >= NOW()`,
        sql`${WalletLotTable.expires_at} < NOW() + make_interval(days => ${withinDays})`,
      ),
    )
    .groupBy(WalletLotTable.expires_at)
    .orderBy(WalletLotTable.expires_at);

  const lots = rows.map((row) => ({ expiresAt: row.expiresAt, amount: Number(row.amount) }));
  return {
    lots,
    totalExpiring: lots.reduce((total, lot) => total + lot.amount, 0),
  };
}

/**
 * 複数ユーザーの失効間近合計額を返す（通知バッチ・管理一覧用）。
 * 失効間近残高が 0 のユーザーは結果に含まれない。
 */
export async function getExpiringSummaryByUsers(
  userIds: string[],
  walletType: WalletTypeValue,
  withinDays: number,
): Promise<UserExpiringAmount[]> {
  if (!isExpirationEnabled(walletType) || withinDays <= 0 || userIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      userId: WalletTable.user_id,
      expiringAmount: sql<number>`SUM(${WalletLotTable.remaining})::int`,
    })
    .from(WalletLotTable)
    .innerJoin(WalletTable, eq(WalletLotTable.wallet_id, WalletTable.id))
    .where(
      and(
        inArray(WalletTable.user_id, userIds),
        eq(WalletTable.type, walletType),
        gt(WalletLotTable.remaining, 0),
        sql`${WalletLotTable.expires_at} >= NOW()`,
        sql`${WalletLotTable.expires_at} < NOW() + make_interval(days => ${withinDays})`,
      ),
    )
    .groupBy(WalletTable.user_id);

  return rows.map((row) => ({ userId: row.userId, expiringAmount: Number(row.expiringAmount) }));
}

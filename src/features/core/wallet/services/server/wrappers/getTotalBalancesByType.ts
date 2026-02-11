// src/features/wallet/services/server/wrappers/getTotalBalancesByType.ts

import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import type { TotalBalanceByType } from "@/features/core/wallet/services/types";
import { db } from "@/lib/drizzle";
import { sql } from "drizzle-orm";

/**
 * 通貨種別ごとの全ユーザー合計残高を取得
 */
export async function getTotalBalancesByType(): Promise<TotalBalanceByType[]> {
  const rows = await db
    .select({
      type: WalletTable.type,
      totalBalance: sql<number>`coalesce(sum(${WalletTable.balance}), 0)::int`,
      totalLockedBalance: sql<number>`coalesce(sum(${WalletTable.locked_balance}), 0)::int`,
    })
    .from(WalletTable)
    .groupBy(WalletTable.type);

  return rows.map((row) => ({
    type: row.type as WalletTypeValue,
    totalBalance: row.totalBalance,
    totalLockedBalance: row.totalLockedBalance,
  }));
}

// src/domains/wallet/services/server/wrappers/getTotalBalancesByType.ts

import { WalletTable } from "@/domains/core/wallet/entities/drizzle";
import { UserTable } from "@/domains/core/user/entities/drizzle";
import type { WalletTypeValue } from "@/domains/core/wallet/types/walletField";
import type { TotalBalanceByType, TotalBalancesByTypeOptions } from "@/domains/core/wallet/services/types";
import { db } from "@/lib/drizzle";
import { eq, sql } from "drizzle-orm";

/**
 * 通貨種別ごとの全ユーザー合計残高を取得
 * role を指定すると、そのロールのユーザーのみ集計する
 */
export async function getTotalBalancesByType(
  options?: TotalBalancesByTypeOptions,
): Promise<TotalBalanceByType[]> {
  const query = db
    .select({
      type: WalletTable.type,
      totalBalance: sql<number>`coalesce(sum(${WalletTable.balance}), 0)::int`,
      totalLockedBalance: sql<number>`coalesce(sum(${WalletTable.locked_balance}), 0)::int`,
    })
    .from(WalletTable);

  if (options?.role) {
    query.innerJoin(UserTable, eq(WalletTable.user_id, UserTable.id));
    query.where(eq(UserTable.role, options.role));
  }

  query.groupBy(WalletTable.type);

  const rows = await query;

  return rows.map((row) => ({
    type: row.type as WalletTypeValue,
    totalBalance: row.totalBalance,
    totalLockedBalance: row.totalLockedBalance,
  }));
}

// src/features/core/wallet/services/server/clearBalance.ts

import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * ユーザーの全ウォレット残高をクリア（0に設定）する
 * - balance と locked_balance を 0 に設定
 * - 残高変更があった場合はウォレット履歴を記録
 * ソフトデリート時のクリーンナップ処理として使用
 */
export async function clearBalance(userId: string, tx: DbTransaction): Promise<void> {
  // ユーザーの全ウォレットを取得（行ロック）
  const wallets = await tx
    .select()
    .from(WalletTable)
    .where(eq(WalletTable.user_id, userId))
    .for("update");

  if (wallets.length === 0) {
    return;
  }

  const requestBatchId = randomUUID();

  for (const wallet of wallets) {
    // 残高が既に0の場合はスキップ
    if (wallet.balance === 0 && wallet.locked_balance === 0) {
      continue;
    }

    const balanceBefore = wallet.balance;

    // 残高を0に設定
    await tx
      .update(WalletTable)
      .set({
        balance: 0,
        locked_balance: 0,
        updatedAt: new Date(),
      })
      .where(eq(WalletTable.id, wallet.id));

    // ウォレット履歴を記録
    await tx.insert(WalletHistoryTable).values({
      user_id: userId,
      type: wallet.type,
      change_method: "SET",
      points_delta: 0,
      balance_before: balanceBefore,
      balance_after: 0,
      source_type: "system",
      request_batch_id: requestBatchId,
      reason: "ユーザーソフトデリートによる残高クリア",
      meta: {},
    });
  }
}

// src/features/core/wallet/services/server/clearBalance.ts

import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { eq, inArray } from "drizzle-orm";
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

  // 残高が0でないウォレットのみ対象
  const nonZeroWallets = wallets.filter(
    (w) => w.balance !== 0 || w.locked_balance !== 0,
  );
  if (nonZeroWallets.length === 0) return;

  // バルクUPDATE: 対象ウォレットの残高を一括で0に設定
  const nonZeroIds = nonZeroWallets.map((w) => w.id);
  await tx
    .update(WalletTable)
    .set({
      balance: 0,
      locked_balance: 0,
      updatedAt: new Date(),
    })
    .where(inArray(WalletTable.id, nonZeroIds));

  // バルクINSERT: ウォレット履歴を一括記録
  await tx.insert(WalletHistoryTable).values(
    nonZeroWallets.map((wallet) => ({
      user_id: userId,
      type: wallet.type,
      change_method: "SET" as const,
      points_delta: 0,
      balance_before: wallet.balance,
      balance_after: 0,
      source_type: "system" as const,
      request_batch_id: requestBatchId,
      reason: "ユーザーソフトデリートによる残高クリア",
      meta: {},
    })),
  );
}

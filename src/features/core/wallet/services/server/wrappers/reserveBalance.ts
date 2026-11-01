// src/features/wallet/services/server/wrappers/reserveBalance.ts

import type { ReserveWalletParams, WalletOperationOptions } from "@/features/core/wallet/services/types";
import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import { eq } from "drizzle-orm";
import {
  ensureSufficientAvailable,
  getOrCreateWallet,
  normalizeAmount,
  runWithTransaction,
  type TransactionClient,
} from "./utils";

export async function reserveBalance(
  params: ReserveWalletParams,
  tx?: TransactionClient,
  options?: WalletOperationOptions,
) {
  const amount = normalizeAmount(params.amount);

  return runWithTransaction(tx, async (trx) => {
    // 渡された wallet は、呼び出し元が同じ TX 内で行ロックを保持している前提で再取得しない
    const wallet = options?.wallet
      ?? await getOrCreateWallet(trx, params.userId, params.walletType, { lock: options?.lock });
    ensureSufficientAvailable(wallet, amount);

    const [updated] = await trx
      .update(WalletTable)
      .set({
        locked_balance: wallet.locked_balance + amount,
        updatedAt: new Date(),
      })
      .where(eq(WalletTable.id, wallet.id))
      .returning();

    return updated;
  });
}

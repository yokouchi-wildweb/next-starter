// src/domains/wallet/services/server/wrappers/releaseReservation.ts

import type { ReleaseReservationParams, WalletOperationOptions } from "@/domains/core/wallet/services/types";
import { WalletTable } from "@/domains/core/wallet/entities/drizzle";
import { eq } from "drizzle-orm";
import {
  ensureLockedAmount,
  getOrCreateWallet,
  normalizeAmount,
  runWithTransaction,
  type TransactionClient,
} from "./utils";

export async function releaseReservation(
  params: ReleaseReservationParams,
  tx?: TransactionClient,
  options?: WalletOperationOptions,
) {
  const amount = normalizeAmount(params.amount);

  return runWithTransaction(tx, async (trx) => {
    const wallet = await getOrCreateWallet(trx, params.userId, params.walletType, { lock: options?.lock });
    ensureLockedAmount(wallet, amount);

    const [updated] = await trx
      .update(WalletTable)
      .set({
        locked_balance: wallet.locked_balance - amount,
        updatedAt: new Date(),
      })
      .where(eq(WalletTable.id, wallet.id))
      .returning();

    return updated;
  });
}

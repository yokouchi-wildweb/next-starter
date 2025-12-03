// src/features/wallet/services/server/wrappers/releaseReservation.ts

import type { ReleaseReservationParams } from "@/features/core/wallet/services/types";
import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import { db } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { ensureLockedAmount, getOrCreateWallet, normalizeAmount } from "./utils";

export async function releaseReservation(params: ReleaseReservationParams) {
  const amount = normalizeAmount(params.amount);

  return db.transaction(async (tx) => {
    const wallet = await getOrCreateWallet(tx, params.userId, params.walletType);
    ensureLockedAmount(wallet, amount);

    const [updated] = await tx
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

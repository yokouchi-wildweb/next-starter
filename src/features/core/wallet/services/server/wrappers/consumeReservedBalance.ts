// src/features/wallet/services/server/wrappers/consumeReservedBalance.ts

import type { ConsumeReservationParams, WalletAdjustmentResult } from "@/features/core/wallet/services/types";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import { db } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { DomainError } from "@/lib/errors/domainError";
import {
  ensureLockedAmount,
  getOrCreateWallet,
  normalizeAmount,
  resolveRequestBatchId,
  sanitizeMeta,
} from "./utils";

export async function consumeReservedBalance(params: ConsumeReservationParams): Promise<WalletAdjustmentResult> {
  const amount = normalizeAmount(params.amount);

  return db.transaction(async (tx) => {
    const wallet = await getOrCreateWallet(tx, params.userId, params.walletType);
    ensureLockedAmount(wallet, amount);
    if (wallet.balance < amount) {
      throw new DomainError("残高が不足しているため確定できません。", { status: 409 });
    }

    const [updated] = await tx
      .update(WalletTable)
      .set({
        balance: wallet.balance - amount,
        locked_balance: wallet.locked_balance - amount,
        updatedAt: new Date(),
      })
      .where(eq(WalletTable.id, wallet.id))
      .returning();

    if (!updated) {
      throw new DomainError("ウォレットの更新に失敗しました。", { status: 500 });
    }

    const historyMeta = sanitizeMeta(params.meta);

    const [history] = await tx
      .insert(WalletHistoryTable)
      .values({
        user_id: params.userId,
        type: params.walletType,
        change_method: "DECREMENT",
        points_delta: amount,
        balance_before: wallet.balance,
        balance_after: updated.balance,
        source_type: params.sourceType,
        request_batch_id: resolveRequestBatchId(params.requestBatchId),
        reason: params.reason ?? null,
        meta: historyMeta ?? undefined,
      })
      .returning();

    return { wallet: updated, history };
  });
}

// src/features/wallet/services/server/wrappers/consumeReservedBalance.ts

import type { ConsumeReservationParams, WalletAdjustmentResult, WalletOperationOptions } from "@/features/core/wallet/services/types";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import { eq } from "drizzle-orm";
import { DomainError } from "@/lib/errors/domainError";
import { DEFAULT_REASON_CATEGORY } from "@/config/app/wallet-reason-category.config";
import { consumeLotsFifo } from "@/features/core/wallet/services/server/lots/lotAccounting";
import { isExpirationEnabled } from "@/features/core/wallet/utils/expiration";
import {
  ensureLockedAmount,
  getOrCreateWallet,
  normalizeAmount,
  resolveRequestBatchId,
  sanitizeMeta,
  runWithTransaction,
  type TransactionClient,
} from "./utils";

export async function consumeReservedBalance(
  params: ConsumeReservationParams,
  tx?: TransactionClient,
  options?: WalletOperationOptions,
): Promise<WalletAdjustmentResult> {
  const amount = normalizeAmount(params.amount);

  return runWithTransaction(tx, async (trx) => {
    // 有効期限が有効な通貨は必ず行ロックで読む（失効スイープとの並走で減算が消失するのを防ぐ）
    const wallet = await getOrCreateWallet(trx, params.userId, params.walletType, {
      lock: options?.lock || isExpirationEnabled(params.walletType),
    });
    ensureLockedAmount(wallet, amount);
    if (wallet.balance < amount) {
      throw new DomainError("残高が不足しているため確定できません。", { status: 409 });
    }

    const [updated] = await trx
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

    // ロット会計: FIFO消費（有効期限が無効な walletType では no-op）
    await consumeLotsFifo(trx, { walletId: wallet.id, walletType: params.walletType, amount });

    const historyMeta = sanitizeMeta(params.meta);

    const [history] = await trx
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
        reason_category: params.reasonCategory ?? DEFAULT_REASON_CATEGORY,
        meta: historyMeta ?? undefined,
      })
      .returning();

    return { wallet: updated, history };
  });
}

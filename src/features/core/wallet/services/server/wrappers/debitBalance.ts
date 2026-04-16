// src/features/wallet/services/server/wrappers/debitBalance.ts

import type { DebitBalanceParams, WalletAdjustmentResult } from "@/features/core/wallet/services/types";
import type { Wallet } from "@/features/core/wallet/entities";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import { eq } from "drizzle-orm";
import { DomainError } from "@/lib/errors/domainError";
import { DEFAULT_REASON_CATEGORY } from "@/config/app/wallet-reason-category.config";
import {
  ensureSufficientAvailable,
  getOrCreateWallet,
  normalizeAmount,
  resolveRequestBatchId,
  sanitizeMeta,
  runWithTransaction,
  type TransactionClient,
} from "./utils";

/**
 * TX内で残高を即時引き落とし（残高減算 + 履歴記録）。
 * reserve → consume の2段階が不要なケース（TX内で完結する処理）向け。
 * locked_balance は操作しない。
 */
export async function debitBalance(
  params: DebitBalanceParams,
  tx?: TransactionClient,
  options?: { wallet?: Wallet },
): Promise<WalletAdjustmentResult> {
  const amount = normalizeAmount(params.amount);

  return runWithTransaction(tx, async (trx) => {
    const wallet = options?.wallet
      ?? await getOrCreateWallet(trx, params.userId, params.walletType);
    ensureSufficientAvailable(wallet, amount);

    const [updated] = await trx
      .update(WalletTable)
      .set({
        balance: wallet.balance - amount,
        updatedAt: new Date(),
      })
      .where(eq(WalletTable.id, wallet.id))
      .returning();

    if (!updated) {
      throw new DomainError("ウォレットの更新に失敗しました。", { status: 500 });
    }

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

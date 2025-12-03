// src/features/wallet/services/server/wrappers/adjustBalance.ts

import type { AdjustWalletParams, WalletAdjustmentResult } from "@/features/core/wallet/services/types";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import { db } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { DomainError } from "@/lib/errors/domainError";
import {
  ensureNotBelowLockedBalance,
  ensureSufficientAvailable,
  getOrCreateWallet,
  normalizeAmount,
  resolveRequestBatchId,
  sanitizeMeta,
} from "./utils";

export async function adjustBalance(params: AdjustWalletParams): Promise<WalletAdjustmentResult> {
  return db.transaction(async (tx) => {
    const wallet = await getOrCreateWallet(tx, params.userId, params.walletType);
    const amount =
      params.changeMethod === "SET"
        ? normalizeAmount(params.amount, { allowZero: true })
        : normalizeAmount(params.amount);

    let nextBalance = wallet.balance;
    if (params.changeMethod === "INCREMENT") {
      nextBalance += amount;
    } else if (params.changeMethod === "DECREMENT") {
      ensureSufficientAvailable(wallet, amount);
      nextBalance -= amount;
    } else if (params.changeMethod === "SET") {
      nextBalance = amount;
    } else {
      throw new DomainError("未知の変更方法です。", { status: 400 });
    }

    ensureNotBelowLockedBalance(wallet, nextBalance);

    const [updated] = await tx
      .update(WalletTable)
      .set({
        balance: nextBalance,
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
        change_method: params.changeMethod,
        points_delta: params.changeMethod === "SET" ? nextBalance : amount,
        balance_before: wallet.balance,
        balance_after: nextBalance,
        source_type: params.sourceType,
        request_batch_id: resolveRequestBatchId(params.requestBatchId),
        reason: params.reason ?? null,
        meta: historyMeta ?? undefined,
      })
      .returning();

    if (!history) {
      throw new DomainError("ウォレット履歴の記録に失敗しました。", { status: 500 });
    }

    return { wallet: updated, history };
  });
}

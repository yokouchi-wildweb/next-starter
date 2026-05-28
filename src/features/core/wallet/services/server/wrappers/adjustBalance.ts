// src/features/wallet/services/server/wrappers/adjustBalance.ts

import type { AdjustWalletParams, WalletAdjustmentResult, AdjustBalanceOptions } from "@/features/core/wallet/services/types";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import { eq } from "drizzle-orm";
import { DomainError } from "@/lib/errors/domainError";
import { DEFAULT_REASON_CATEGORY } from "@/config/app/wallet-reason-category.config";
import { auditLogger } from "@/features/core/auditLog/services/server";
import {
  ensureNotBelowLockedBalance,
  ensureSufficientAvailable,
  getOrCreateWallet,
  normalizeAmount,
  resolveRequestBatchId,
  sanitizeMeta,
  runWithTransaction,
  type TransactionClient,
} from "./utils";

// ウォレット系の audit retention（コンプライアンス対応で 2 年）
const WALLET_AUDIT_RETENTION_DAYS = 730;

export async function adjustBalance(
  params: AdjustWalletParams,
  tx?: TransactionClient,
  options?: AdjustBalanceOptions,
): Promise<WalletAdjustmentResult> {
  return runWithTransaction(tx, async (trx) => {
    const wallet = options?.wallet
      ?? await getOrCreateWallet(trx, params.userId, params.walletType, { lock: options?.lock });
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

    const [updated] = await trx
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

    // skipHistory: true の場合は履歴記録をスキップ
    if (options?.skipHistory) {
      return { wallet: updated, history: null };
    }

    const historyMeta = sanitizeMeta(params.meta);

    const [history] = await trx
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
        reason_category: params.reasonCategory ?? DEFAULT_REASON_CATEGORY,
        meta: historyMeta ?? undefined,
      })
      .returning();

    if (!history) {
      throw new DomainError("ウォレット履歴の記録に失敗しました。", { status: 500 });
    }

    // 「介入」ログ: 管理者残高調整を audit に残す。
    // actor は ALS から自動注入される（admin/system/user を区別する用途）。
    await auditLogger.record({
      targetType: "wallet",
      targetId: updated.id,
      subjectUserId: params.userId,
      action: "wallet.balance.adjusted",
      before: { balance: wallet.balance, locked_balance: wallet.locked_balance },
      after: { balance: updated.balance, locked_balance: updated.locked_balance },
      metadata: {
        userId: params.userId,
        walletType: params.walletType,
        changeMethod: params.changeMethod,
        amount,
        sourceType: params.sourceType,
        requestBatchId: history.request_batch_id,
        reasonCategory: params.reasonCategory ?? DEFAULT_REASON_CATEGORY,
        walletHistoryId: history.id,
      },
      reason: params.reason ?? null,
      retentionDays: WALLET_AUDIT_RETENTION_DAYS,
      tx: trx,
    });

    return { wallet: updated, history };
  });
}

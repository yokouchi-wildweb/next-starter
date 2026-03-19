// src/features/wallet/services/server/wrappers/bulkAdjustByUsers.ts

import type { Wallet } from "@/features/core/wallet/entities";
import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import type { WalletHistoryMeta } from "@/features/core/walletHistory/types/meta";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import type { WalletHistoryChangeMethodValue, WalletHistorySourceTypeValue } from "@/features/core/walletHistory/types/field";
import type { ReasonCategory } from "@/config/app/wallet-reason-category.config";
import { DEFAULT_REASON_CATEGORY } from "@/config/app/wallet-reason-category.config";
import type { ChunkResult } from "@/features/batchJob/types";
import { normalizeAmount, sanitizeMeta, resolveRequestBatchId } from "./utils";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { and, eq, inArray, sql } from "drizzle-orm";

export type BulkAdjustByUsersParams = {
  walletType: WalletTypeValue;
  changeMethod: WalletHistoryChangeMethodValue;
  amount: number;
  sourceType: WalletHistorySourceTypeValue;
  requestBatchId?: string | null;
  reason?: string | null;
  reasonCategory?: ReasonCategory;
  meta?: Record<string, unknown>;
};

/**
 * 指定されたユーザーIDリストに対してウォレット残高を一括調整する。
 * バッチジョブの processChunk ハンドラから呼ばれることを想定。
 * txは呼び出し元が管理する。
 */
export async function bulkAdjustByUsers(
  tx: TransactionClient,
  userIds: string[],
  params: BulkAdjustByUsersParams,
): Promise<ChunkResult> {
  const amount =
    params.changeMethod === "SET"
      ? normalizeAmount(params.amount, { allowZero: true })
      : normalizeAmount(params.amount);

  const requestBatchId = resolveRequestBatchId(params.requestBatchId);
  const meta = sanitizeMeta(params.meta);
  const reasonCategory = params.reasonCategory ?? DEFAULT_REASON_CATEGORY;

  // 1. 既存ウォレットを一括取得
  const existingWallets = await tx
    .select()
    .from(WalletTable)
    .where(and(eq(WalletTable.type, params.walletType), inArray(WalletTable.user_id, userIds)));

  const existingUserIds = new Set(existingWallets.map((w) => w.user_id));

  // 2. 未作成ユーザーのウォレットを一括INSERT (ON CONFLICT DO NOTHING)
  const missingUserIds = userIds.filter((uid) => !existingUserIds.has(uid));
  if (missingUserIds.length > 0) {
    await tx
      .insert(WalletTable)
      .values(missingUserIds.map((uid) => ({ user_id: uid, type: params.walletType })))
      .onConflictDoNothing();
  }

  // 3. 全ウォレットを SELECT FOR UPDATE でロック
  const lockedWallets = await tx
    .select()
    .from(WalletTable)
    .where(and(eq(WalletTable.type, params.walletType), inArray(WalletTable.user_id, userIds)))
    .for("update");

  // userId → wallet のマップ
  const walletByUserId = new Map(lockedWallets.map((w) => [w.user_id, w]));

  // 4. classifyWallets で成功/スキップ分類
  const succeeded: string[] = [];
  const failed: { itemKey: string; error: string }[] = [];
  const skipped: { itemKey: string; reason: string }[] = [];
  const toUpdate: Array<Wallet & { nextBalance: number; nextLockedBalance: number }> = [];

  for (const userId of userIds) {
    const wallet = walletByUserId.get(userId);
    if (!wallet) {
      failed.push({ itemKey: userId, error: "ウォレットの取得に失敗しました" });
      continue;
    }

    let nextBalance = wallet.balance;
    let nextLockedBalance = wallet.locked_balance;

    if (params.changeMethod === "SET") {
      nextBalance = amount;
      if (nextLockedBalance > nextBalance) {
        nextLockedBalance = nextBalance;
      }
    } else if (params.changeMethod === "INCREMENT") {
      nextBalance += amount;
    } else if (params.changeMethod === "DECREMENT") {
      const available = wallet.balance - wallet.locked_balance;
      if (available < amount) {
        skipped.push({ itemKey: userId, reason: "残高不足" });
        continue;
      }
      nextBalance -= amount;
    }

    // 変更なし
    if (nextBalance === wallet.balance && nextLockedBalance === wallet.locked_balance) {
      skipped.push({ itemKey: userId, reason: "変更なし" });
      continue;
    }

    toUpdate.push({ ...(wallet as Wallet), nextBalance, nextLockedBalance });
    succeeded.push(userId);
  }

  // 5. バルク UPDATE (balance)
  if (toUpdate.length > 0) {
    const walletIds = toUpdate.map((w) => w.id);

    if (params.changeMethod === "SET") {
      await tx
        .update(WalletTable)
        .set({
          balance: amount,
          locked_balance: sql`LEAST(${WalletTable.locked_balance}, ${amount})`,
          updatedAt: new Date(),
        })
        .where(inArray(WalletTable.id, walletIds));
    } else if (params.changeMethod === "INCREMENT") {
      await tx
        .update(WalletTable)
        .set({
          balance: sql`${WalletTable.balance} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(inArray(WalletTable.id, walletIds));
    } else if (params.changeMethod === "DECREMENT") {
      await tx
        .update(WalletTable)
        .set({
          balance: sql`${WalletTable.balance} - ${amount}`,
          updatedAt: new Date(),
        })
        .where(inArray(WalletTable.id, walletIds));
    }

    // 6. バルク INSERT (wallet_history, 共通のrequest_batch_id)
    const historyValues = toUpdate.map((w) => ({
      user_id: w.user_id,
      type: params.walletType,
      change_method: params.changeMethod as "INCREMENT" | "DECREMENT" | "SET",
      points_delta: params.changeMethod === "SET" ? w.nextBalance : amount,
      balance_before: w.balance,
      balance_after: w.nextBalance,
      source_type: params.sourceType as "user_action" | "admin_action" | "system",
      request_batch_id: requestBatchId,
      reason: params.reason ?? null,
      reason_category: reasonCategory,
      meta: (meta ?? {}) as Record<string, unknown>,
    }));

    await tx.insert(WalletHistoryTable).values(historyValues);
  }

  // 7. ChunkResult 返却
  return { succeeded, failed, skipped };
}

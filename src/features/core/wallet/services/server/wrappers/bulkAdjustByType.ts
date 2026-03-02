// src/features/wallet/services/server/wrappers/bulkAdjustByType.ts

import type { Wallet } from "@/features/core/wallet/entities";
import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import type {
  BulkAdjustByTypeParams,
  BulkAdjustByTypeResult,
} from "@/features/core/wallet/services/types";
import { DEFAULT_REASON_CATEGORY, type ReasonCategory } from "@/config/app/wallet-reason-category.config";
import type { WalletHistoryMeta } from "@/features/core/walletHistory/types/meta";
import { normalizeAmount, resolveRequestBatchId, sanitizeMeta } from "./utils";
import { runWithTransaction, type TransactionClient } from "./utils";
import { eq, and, sql, inArray } from "drizzle-orm";

/**
 * 特定の通貨種別に対し、全ユーザーのウォレット残高を一括操作する
 *
 * - SET: balance を指定値に設定（locked_balance が超過する場合は locked_balance も調整）
 * - INCREMENT: balance に加算
 * - DECREMENT: 利用可能残高（balance - locked_balance）が不足するウォレットはスキップ
 *
 * 全変更に対して共通の requestBatchId で履歴を記録する
 */
export async function bulkAdjustByType(
  params: BulkAdjustByTypeParams,
  tx?: TransactionClient,
): Promise<BulkAdjustByTypeResult> {
  const amount =
    params.changeMethod === "SET"
      ? normalizeAmount(params.amount, { allowZero: true })
      : normalizeAmount(params.amount);

  const requestBatchId = resolveRequestBatchId(params.requestBatchId);
  const meta = sanitizeMeta(params.meta);
  const reasonCategory = params.reasonCategory ?? DEFAULT_REASON_CATEGORY;

  return runWithTransaction(tx, async (trx) => {
    // 対象ウォレットを取得（行ロック）
    const targetWallets = await selectTargetWallets(trx, params);

    if (targetWallets.length === 0) {
      return { affectedCount: 0, skippedCount: 0, requestBatchId };
    }

    // changeMethod に応じて対象を振り分け
    const { toUpdate, skipped } = classifyWallets(targetWallets, params.changeMethod, amount);

    if (toUpdate.length === 0) {
      return { affectedCount: 0, skippedCount: skipped.length, requestBatchId };
    }

    // バルクUPDATE
    await executeBalanceUpdate(trx, toUpdate, params.changeMethod, amount);

    // バルクINSERT: 履歴
    await insertHistoryRecords(trx, toUpdate, params, amount, requestBatchId, reasonCategory, meta);

    return {
      affectedCount: toUpdate.length,
      skippedCount: skipped.length,
      requestBatchId,
    };
  });
}

// --- 内部関数 ---

type WalletWithNext = Wallet & { nextBalance: number; nextLockedBalance: number };

/** 対象ウォレットを取得（role フィルタ対応） */
async function selectTargetWallets(
  tx: TransactionClient,
  params: BulkAdjustByTypeParams,
): Promise<Wallet[]> {
  const selectFields = {
    id: WalletTable.id,
    user_id: WalletTable.user_id,
    type: WalletTable.type,
    balance: WalletTable.balance,
    locked_balance: WalletTable.locked_balance,
    updatedAt: WalletTable.updatedAt,
  };

  if (params.role) {
    const rows = await tx
      .select(selectFields)
      .from(WalletTable)
      .innerJoin(UserTable, eq(WalletTable.user_id, UserTable.id))
      .where(and(eq(WalletTable.type, params.walletType), eq(UserTable.role, params.role)))
      .for("update", { of: WalletTable });
    return rows as Wallet[];
  }

  const rows = await tx
    .select(selectFields)
    .from(WalletTable)
    .where(eq(WalletTable.type, params.walletType))
    .for("update", { of: WalletTable });
  return rows as Wallet[];
}

/** ウォレットを更新対象とスキップ対象に振り分ける */
function classifyWallets(
  wallets: Wallet[],
  changeMethod: string,
  amount: number,
): { toUpdate: WalletWithNext[]; skipped: Wallet[] } {
  const toUpdate: WalletWithNext[] = [];
  const skipped: Wallet[] = [];

  for (const w of wallets) {
    let nextBalance = w.balance;
    let nextLockedBalance = w.locked_balance;

    if (changeMethod === "SET") {
      nextBalance = amount;
      // locked_balance が新しい balance を超える場合は調整
      if (nextLockedBalance > nextBalance) {
        nextLockedBalance = nextBalance;
      }
    } else if (changeMethod === "INCREMENT") {
      nextBalance += amount;
    } else if (changeMethod === "DECREMENT") {
      const available = w.balance - w.locked_balance;
      if (available < amount) {
        skipped.push(w);
        continue;
      }
      nextBalance -= amount;
    }

    // 変更がないウォレットはスキップ（SET で同じ値の場合等）
    if (nextBalance === w.balance && nextLockedBalance === w.locked_balance) {
      skipped.push(w);
      continue;
    }

    toUpdate.push({ ...w, nextBalance, nextLockedBalance });
  }

  return { toUpdate, skipped };
}

/** バルクUPDATE: changeMethod に応じた一括更新 */
async function executeBalanceUpdate(
  tx: TransactionClient,
  wallets: WalletWithNext[],
  changeMethod: string,
  amount: number,
): Promise<void> {
  const walletIds = wallets.map((w) => w.id);

  if (changeMethod === "SET") {
    // SET: locked_balance も調整が必要なためCASE文を使用
    const lockedBalanceCases = wallets.map(
      (w) => sql`WHEN ${WalletTable.id} = ${w.id} THEN ${w.nextLockedBalance}`,
    );
    await tx
      .update(WalletTable)
      .set({
        balance: amount,
        locked_balance: sql`CASE ${sql.join(lockedBalanceCases, sql` `)} ELSE ${WalletTable.locked_balance} END`,
        updatedAt: new Date(),
      })
      .where(inArray(WalletTable.id, walletIds));
  } else if (changeMethod === "INCREMENT") {
    await tx
      .update(WalletTable)
      .set({
        balance: sql`${WalletTable.balance} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(inArray(WalletTable.id, walletIds));
  } else if (changeMethod === "DECREMENT") {
    await tx
      .update(WalletTable)
      .set({
        balance: sql`${WalletTable.balance} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(inArray(WalletTable.id, walletIds));
  }
}

/** バルクINSERT: 履歴レコード一括作成 */
async function insertHistoryRecords(
  tx: TransactionClient,
  wallets: WalletWithNext[],
  params: BulkAdjustByTypeParams,
  amount: number,
  requestBatchId: string,
  reasonCategory: ReasonCategory,
  meta: WalletHistoryMeta | null,
): Promise<void> {
  const historyValues = wallets.map((w) => ({
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
    meta: meta ?? {},
  }));

  await tx.insert(WalletHistoryTable).values(historyValues);
}

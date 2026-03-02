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
import { type TransactionClient } from "./utils";
import { db } from "@/lib/drizzle";
import { eq, and, sql, gt, inArray } from "drizzle-orm";

/** バッチサイズ: 1回のトランザクションで処理するウォレット数 */
const BATCH_SIZE = 1000;

/**
 * 特定の通貨種別に対し、全ユーザーのウォレット残高を一括操作する
 *
 * - SET: balance を指定値に設定（locked_balance が超過する場合は locked_balance も調整）
 * - INCREMENT: balance に加算
 * - DECREMENT: 利用可能残高（balance - locked_balance）が不足するウォレットはスキップ
 *
 * パフォーマンス:
 * - BATCH_SIZE 件ずつ独立したトランザクションで処理（メモリ・ロック範囲を制限）
 * - id カーソルベースのページネーションで全件を走査
 * - 全変更に対して共通の requestBatchId で履歴を記録
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

  // 外部トランザクションが渡された場合はバッチ分割せず単一トランザクションで処理
  if (tx) {
    return executeSingleBatch(tx, params, amount, requestBatchId, reasonCategory, meta);
  }

  // バッチ分割処理: 各バッチが独立したトランザクション
  let totalAffected = 0;
  let totalSkipped = 0;
  let cursor: string | null = null;

  while (true) {
    const batchResult = await db.transaction(async (trx) => {
      const wallets = await selectBatch(trx, params, cursor, BATCH_SIZE);

      if (wallets.length === 0) {
        return { affected: 0, skipped: 0, lastId: null, hasMore: false };
      }

      const lastId = wallets[wallets.length - 1]!.id;
      const { toUpdate, skipped } = classifyWallets(wallets, params.changeMethod, amount);

      if (toUpdate.length > 0) {
        await executeBalanceUpdate(trx, toUpdate, params.changeMethod, amount);
        await insertHistoryRecords(trx, toUpdate, params, amount, requestBatchId, reasonCategory, meta);
      }

      return {
        affected: toUpdate.length,
        skipped: skipped.length,
        lastId,
        hasMore: wallets.length === BATCH_SIZE,
      };
    });

    totalAffected += batchResult.affected;
    totalSkipped += batchResult.skipped;

    if (!batchResult.hasMore || batchResult.lastId === null) {
      break;
    }
    cursor = batchResult.lastId;
  }

  return { affectedCount: totalAffected, skippedCount: totalSkipped, requestBatchId };
}

// --- 内部関数 ---

type WalletWithNext = Wallet & { nextBalance: number; nextLockedBalance: number };

/** 外部トランザクション指定時: バッチ分割せず単一実行 */
async function executeSingleBatch(
  tx: TransactionClient,
  params: BulkAdjustByTypeParams,
  amount: number,
  requestBatchId: string,
  reasonCategory: ReasonCategory,
  meta: WalletHistoryMeta | null,
): Promise<BulkAdjustByTypeResult> {
  let totalAffected = 0;
  let totalSkipped = 0;
  let cursor: string | null = null;

  while (true) {
    const wallets = await selectBatch(tx, params, cursor, BATCH_SIZE);
    if (wallets.length === 0) break;

    const lastId = wallets[wallets.length - 1]!.id;
    const { toUpdate, skipped } = classifyWallets(wallets, params.changeMethod, amount);

    if (toUpdate.length > 0) {
      await executeBalanceUpdate(tx, toUpdate, params.changeMethod, amount);
      await insertHistoryRecords(tx, toUpdate, params, amount, requestBatchId, reasonCategory, meta);
    }

    totalAffected += toUpdate.length;
    totalSkipped += skipped.length;

    if (wallets.length < BATCH_SIZE) break;
    cursor = lastId;
  }

  return { affectedCount: totalAffected, skippedCount: totalSkipped, requestBatchId };
}

/** カーソルベースでバッチ取得（行ロック付き） */
async function selectBatch(
  tx: TransactionClient,
  params: BulkAdjustByTypeParams,
  cursor: string | null,
  limit: number,
): Promise<Wallet[]> {
  const selectFields = {
    id: WalletTable.id,
    user_id: WalletTable.user_id,
    type: WalletTable.type,
    balance: WalletTable.balance,
    locked_balance: WalletTable.locked_balance,
    updatedAt: WalletTable.updatedAt,
  };

  const conditions = [eq(WalletTable.type, params.walletType)];
  if (cursor) {
    conditions.push(gt(WalletTable.id, cursor));
  }

  if (params.role) {
    const rows = await tx
      .select(selectFields)
      .from(WalletTable)
      .innerJoin(UserTable, eq(WalletTable.user_id, UserTable.id))
      .where(and(...conditions, eq(UserTable.role, params.role)))
      .orderBy(WalletTable.id)
      .limit(limit)
      .for("update", { of: WalletTable });
    return rows as Wallet[];
  }

  const rows = await tx
    .select(selectFields)
    .from(WalletTable)
    .where(and(...conditions))
    .orderBy(WalletTable.id)
    .limit(limit)
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

    // 変更がないウォレットはスキップ
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
    // LEAST で locked_balance を新 balance 以下に抑える（CASE WHEN 不要）
    await tx
      .update(WalletTable)
      .set({
        balance: amount,
        locked_balance: sql`LEAST(${WalletTable.locked_balance}, ${amount})`,
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

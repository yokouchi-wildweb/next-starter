// src/features/core/wallet/services/server/lots/initWalletLotsFromHistory.ts
// ロット初期化（履歴ベース）: 既存残高を「実際の付与日」でロット化する
//
// initWalletLots は全残高を「実行日取得扱い」の1本にするため、導入から expirationDays の間は
// 何も失効しない。こちらは wallet_histories の付与履歴からロットを復元するので、
// 導入時点で既に expirationDays を超えて残っている分は期限切れロットになり、
// 次回の失効スイープ（wallet-expire-lots）で没収される。
//
// - 既存ロットは全破棄してから作り直す（re-baseline）ため、再実行も安全
// - 没収そのものは行わない（履歴・audit・通知は通常のスイープ経路に任せる）
// - dryRun: true は書き込みなしで件数と金額だけを返す
//
// [!!] initWalletLots とどちらか一方だけを、導入時に1回実行すること。
//     前提: 直近 expirationDays ぶんの wallet_histories が欠けていないこと。
//
// 実行方法: pnpm task wallet-lots-init-from-history -- --dry-run で確認 → dry-run なしで実行

import { and, desc, eq, gt, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { WalletTable, WalletLotTable } from "@/features/core/wallet/entities/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { runAsSystem } from "@/lib/audit";
import {
  getExpirationDays,
  getExpirationEnabledWalletTypes,
} from "@/features/core/wallet/utils/expiration";
import {
  planLotsFromHistory,
  type LotHistoryEntry,
} from "@/features/core/wallet/utils/lotPlanning";
import { resolveRequestBatchId } from "../wrappers/utils";
import type { Wallet } from "@/features/core/wallet/entities";

/** 1トランザクションで処理するウォレット数（履歴を読み込むため initWalletLots より小さくする） */
const WALLET_BATCH_SIZE = 200;

/** 1文で INSERT するロット数 */
const LOT_INSERT_CHUNK_SIZE = 1000;

/** ウォレット系 audit retention（コンプライアンス対応で 2 年） */
const WALLET_AUDIT_RETENTION_DAYS = 730;

export type InitWalletLotsFromHistoryOptions = {
  dryRun?: boolean;
};

export type InitWalletLotsFromHistoryResult = {
  /** 対象 walletType（カンマ区切り。有効な通貨がない場合は空文字） */
  walletTypes: string;
  dryRun: boolean;
  /** ロットを作成したウォレット数（balance > 0 のみ） */
  initializedWallets: number;
  /** 作成したロット数 */
  createdLots: number;
  /** ロットの合計額（= 対象ウォレットの残高合計） */
  totalAmount: number;
  /** 既に期限を過ぎた分を持つウォレット数（次回スイープの没収対象） */
  overdueWallets: number;
  /** 既に期限を過ぎた分の合計額（locked_balance 保護により実際の没収額はこれ以下） */
  overdueAmount: number;
};

/**
 * 有効期限が有効な全通貨の既存残高を、付与履歴に基づくロットに変換する。
 */
export async function initWalletLotsFromHistory(
  options: InitWalletLotsFromHistoryOptions = {},
): Promise<InitWalletLotsFromHistoryResult> {
  const dryRun = options.dryRun ?? false;
  const walletTypes = getExpirationEnabledWalletTypes();

  if (walletTypes.length === 0) {
    return {
      walletTypes: "",
      dryRun,
      initializedWallets: 0,
      createdLots: 0,
      totalAmount: 0,
      overdueWallets: 0,
      overdueAmount: 0,
    };
  }

  return runAsSystem(async () => {
    const requestBatchId = resolveRequestBatchId(null);
    const startedAt = new Date();
    let initializedWallets = 0;
    let createdLots = 0;
    let totalAmount = 0;
    let overdueWallets = 0;
    let overdueAmount = 0;

    for (const walletType of walletTypes) {
      const expirationDays = getExpirationDays(walletType);
      if (expirationDays === null) continue;

      // これより前の付与は既に期限を過ぎているため、履歴を読む必要がない
      const windowStart = new Date(startedAt);
      windowStart.setDate(windowStart.getDate() - expirationDays);

      let cursor: string | null = null;

      while (true) {
        const batch = await db.transaction(async (trx) => {
          const conditions = [eq(WalletTable.type, walletType)];
          if (cursor) {
            conditions.push(gt(WalletTable.id, cursor));
          }

          const walletQuery = trx
            .select()
            .from(WalletTable)
            .where(and(...conditions))
            .orderBy(WalletTable.id)
            .limit(WALLET_BATCH_SIZE);

          // 並走する残高変更と直列化するため行ロックで取得（dryRun は書き込まないのでロックしない）
          const wallets = (await (dryRun
            ? walletQuery
            : walletQuery.for("update", { of: WalletTable }))) as Wallet[];

          const empty = { count: 0, lots: 0, amount: 0, overdueCount: 0, overdue: 0 };
          if (wallets.length === 0) {
            return { ...empty, lastId: null, hasMore: false };
          }

          const lastId = wallets[wallets.length - 1]!.id;
          const hasMore = wallets.length === WALLET_BATCH_SIZE;
          const targets = wallets.filter((w) => w.balance > 0);

          // re-baseline: 既存ロットを破棄してから作り直す
          if (!dryRun) {
            await trx.delete(WalletLotTable).where(
              inArray(
                WalletLotTable.wallet_id,
                wallets.map((w) => w.id),
              ),
            );
          }

          if (targets.length === 0) {
            return { ...empty, lastId, hasMore };
          }

          // 対象ウォレットの付与履歴（新しい順）
          const histories = await trx
            .select({
              user_id: WalletHistoryTable.user_id,
              change_method: WalletHistoryTable.change_method,
              points_delta: WalletHistoryTable.points_delta,
              balance_after: WalletHistoryTable.balance_after,
              createdAt: WalletHistoryTable.createdAt,
            })
            .from(WalletHistoryTable)
            .where(
              and(
                eq(WalletHistoryTable.type, walletType),
                inArray(
                  WalletHistoryTable.user_id,
                  targets.map((w) => w.user_id),
                ),
                inArray(WalletHistoryTable.change_method, ["INCREMENT", "SET"]),
                gte(WalletHistoryTable.createdAt, windowStart),
              ),
            )
            .orderBy(
              WalletHistoryTable.user_id,
              desc(WalletHistoryTable.createdAt),
              desc(WalletHistoryTable.id),
            );

          const entriesByUser = new Map<string, LotHistoryEntry[]>();
          for (const row of histories) {
            if (row.createdAt === null || row.change_method === "DECREMENT") continue;
            const list = entriesByUser.get(row.user_id) ?? [];
            list.push({
              changeMethod: row.change_method,
              amount: row.change_method === "SET" ? row.balance_after : row.points_delta,
              createdAt: row.createdAt,
            });
            entriesByUser.set(row.user_id, list);
          }

          const lotRows: (typeof WalletLotTable.$inferInsert)[] = [];
          let overdueCount = 0;
          let overdue = 0;

          for (const wallet of targets) {
            const plan = planLotsFromHistory({
              balance: wallet.balance,
              entries: entriesByUser.get(wallet.user_id) ?? [],
              expirationDays,
              overdueExpiresAt: startedAt,
            });

            for (const lot of plan.lots) {
              lotRows.push({
                wallet_id: wallet.id,
                granted_amount: lot.grantedAmount,
                remaining: lot.remaining,
                expires_at: lot.expiresAt,
              });
            }
            if (plan.overdueAmount > 0) {
              overdueCount += 1;
              overdue += plan.overdueAmount;
            }
          }

          if (!dryRun) {
            for (let i = 0; i < lotRows.length; i += LOT_INSERT_CHUNK_SIZE) {
              await trx
                .insert(WalletLotTable)
                .values(lotRows.slice(i, i + LOT_INSERT_CHUNK_SIZE));
            }
          }

          return {
            count: targets.length,
            lots: lotRows.length,
            amount: targets.reduce((total, w) => total + w.balance, 0),
            overdueCount,
            overdue,
            lastId,
            hasMore,
          };
        });

        initializedWallets += batch.count;
        createdLots += batch.lots;
        totalAmount += batch.amount;
        overdueWallets += batch.overdueCount;
        overdueAmount += batch.overdue;

        if (!batch.hasMore || batch.lastId === null) break;
        cursor = batch.lastId;
      }
    }

    if (!dryRun) {
      // 「介入」ログ: 実行単位で1行集約（バッチごとの tx は commit 済みのため bestEffort）
      await auditLogger.record({
        targetType: "wallet",
        targetId: requestBatchId,
        // 全ユーザー一括の初期化（run 単位の集約行）のため対象ユーザーは特定しない
        subjectUserId: null,
        action: "wallet.lots.initialized",
        metadata: {
          mode: "from_history",
          walletTypes,
          initializedWallets,
          createdLots,
          totalAmount,
          overdueWallets,
          overdueAmount,
          requestBatchId,
        },
        reason: "ウォレット有効期限導入に伴う初期ロット作成（付与履歴に基づく復元）",
        retentionDays: WALLET_AUDIT_RETENTION_DAYS,
        bestEffort: true,
      });
    }

    return {
      walletTypes: walletTypes.join(","),
      dryRun,
      initializedWallets,
      createdLots,
      totalAmount,
      overdueWallets,
      overdueAmount,
    };
  });
}

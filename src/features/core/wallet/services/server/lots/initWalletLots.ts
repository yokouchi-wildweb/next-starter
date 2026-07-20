// src/features/core/wallet/services/server/lots/initWalletLots.ts
// ロット初期化（導入時に1回実行する必須手順）
//
// 有効期限が有効な全 walletType について、既存残高を
// 「実行日に取得した扱い」の初期ロット1本（expires_at = 実行時刻 + expirationDays）に変換する。
// 既存ロットは全破棄してから作り直す（re-baseline）ため、再実行も安全。
//
// [!!] 再実行すると全ユーザーの失効カウントが実行日からリセットされる。
//     通常は導入時の1回だけ実行し、再実行は障害復旧（無効化→再有効化）の場合に限ること。
//
// 実行方法: pnpm task wallet-lots-init
// 詳細な導入手順: src/features/core/wallet/README.md

import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { WalletTable, WalletLotTable } from "@/features/core/wallet/entities/drizzle";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { runAsSystem } from "@/lib/audit";
import {
  calcExpiresAt,
  getExpirationDays,
  getExpirationEnabledWalletTypes,
} from "@/features/core/wallet/utils/expiration";
import { resolveRequestBatchId } from "../wrappers/utils";

/** 1トランザクションで処理するウォレット数 */
const BATCH_SIZE = 1000;

/** ウォレット系 audit retention（コンプライアンス対応で 2 年） */
const WALLET_AUDIT_RETENTION_DAYS = 730;

export type InitWalletLotsResult = {
  /** 対象 walletType（カンマ区切り。有効な通貨がない場合は空文字） */
  walletTypes: string;
  /** 初期ロットを作成したウォレット数（balance > 0 のみ） */
  initializedWallets: number;
  /** 初期ロットの合計額 */
  totalAmount: number;
};

/**
 * 有効期限が有効な全通貨の既存残高を初期ロットに変換する。
 */
export async function initWalletLots(): Promise<InitWalletLotsResult> {
  const walletTypes = getExpirationEnabledWalletTypes();

  if (walletTypes.length === 0) {
    return { walletTypes: "", initializedWallets: 0, totalAmount: 0 };
  }

  return runAsSystem(async () => {
    const requestBatchId = resolveRequestBatchId(null);
    let initializedWallets = 0;
    let totalAmount = 0;

    for (const walletType of walletTypes) {
      const expirationDays = getExpirationDays(walletType);
      if (expirationDays === null) continue;

      let cursor: string | null = null;

      while (true) {
        const batch = await db.transaction(async (trx) => {
          const conditions = [eq(WalletTable.type, walletType)];
          if (cursor) {
            conditions.push(gt(WalletTable.id, cursor));
          }

          // 並走する残高変更と直列化するため行ロックで取得
          const wallets = await trx
            .select()
            .from(WalletTable)
            .where(and(...conditions))
            .orderBy(WalletTable.id)
            .limit(BATCH_SIZE)
            .for("update", { of: WalletTable });

          if (wallets.length === 0) {
            return { count: 0, amount: 0, lastId: null, hasMore: false };
          }

          const lastId = wallets[wallets.length - 1]!.id;
          const walletIds = wallets.map((w) => w.id);

          // re-baseline: 既存ロットを破棄してから残高分の初期ロットを作成
          await trx.delete(WalletLotTable).where(inArray(WalletLotTable.wallet_id, walletIds));

          const now = new Date();
          const expiresAt = calcExpiresAt(now, expirationDays);
          const targets = wallets.filter((w) => w.balance > 0);

          if (targets.length > 0) {
            await trx.insert(WalletLotTable).values(
              targets.map((w) => ({
                wallet_id: w.id,
                granted_amount: w.balance,
                remaining: w.balance,
                expires_at: expiresAt,
              })),
            );
          }

          return {
            count: targets.length,
            amount: targets.reduce((total, w) => total + w.balance, 0),
            lastId,
            hasMore: wallets.length === BATCH_SIZE,
          };
        });

        initializedWallets += batch.count;
        totalAmount += batch.amount;

        if (!batch.hasMore || batch.lastId === null) break;
        cursor = batch.lastId;
      }
    }

    // 「介入」ログ: 実行単位で1行集約（バッチごとの tx は commit 済みのため bestEffort）
    await auditLogger.record({
      targetType: "wallet",
      targetId: requestBatchId,
      // 全ユーザー一括の初期化（run 単位の集約行）のため対象ユーザーは特定しない
      subjectUserId: null,
      action: "wallet.lots.initialized",
      metadata: {
        walletTypes,
        initializedWallets,
        totalAmount,
        requestBatchId,
      },
      reason: "ウォレット有効期限導入に伴う初期ロット作成（既存残高の re-baseline）",
      retentionDays: WALLET_AUDIT_RETENTION_DAYS,
      bestEffort: true,
    });

    return {
      walletTypes: walletTypes.join(","),
      initializedWallets,
      totalAmount,
    };
  });
}

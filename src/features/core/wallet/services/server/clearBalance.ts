// src/features/core/wallet/services/server/clearBalance.ts

import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { clearLots } from "@/features/core/wallet/services/server/lots/lotAccounting";
import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

/** ウォレット系 audit retention（コンプライアンス対応で 2 年） */
const WALLET_AUDIT_RETENTION_DAYS = 730;

/**
 * ユーザーの全ウォレット残高をクリア（0に設定）する
 * - balance と locked_balance を 0 に設定
 * - 残高変更があった場合はウォレット履歴を記録
 * ソフトデリート時のクリーンナップ処理として使用
 */
export async function clearBalance(userId: string, tx: DbTransaction): Promise<void> {
  // ユーザーの全ウォレットを取得（行ロック）
  const wallets = await tx
    .select()
    .from(WalletTable)
    .where(eq(WalletTable.user_id, userId))
    .for("update");

  if (wallets.length === 0) {
    return;
  }

  const requestBatchId = randomUUID();

  // 残高が0でないウォレットのみ対象
  const nonZeroWallets = wallets.filter(
    (w) => w.balance !== 0 || w.locked_balance !== 0,
  );
  if (nonZeroWallets.length === 0) return;

  // バルクUPDATE: 対象ウォレットの残高を一括で0に設定
  const nonZeroIds = nonZeroWallets.map((w) => w.id);
  await tx
    .update(WalletTable)
    .set({
      balance: 0,
      locked_balance: 0,
      updatedAt: new Date(),
    })
    .where(inArray(WalletTable.id, nonZeroIds));

  // ロット会計: 残高0化に合わせてロットも全削除（有効期限が無効な通貨には行が存在せず no-op）
  await clearLots(tx, nonZeroIds);

  // バルクINSERT: ウォレット履歴を一括記録
  await tx.insert(WalletHistoryTable).values(
    nonZeroWallets.map((wallet) => ({
      user_id: userId,
      type: wallet.type,
      change_method: "SET" as const,
      points_delta: 0,
      balance_before: wallet.balance,
      balance_after: 0,
      source_type: "system" as const,
      request_batch_id: requestBatchId,
      reason: "ユーザーソフトデリートによる残高クリア",
      reason_category: "system" as const,
      meta: {},
    })),
  );

  // 「介入」ログ: 通常業務フロー外の残高消去なのでウォレット単位で audit を残す。
  // 件数はユーザーあたり数件（通貨種別数）に収まる前提で detail 記録（recordMany）。
  await auditLogger.recordMany(
    nonZeroWallets.map((wallet) => ({
      targetType: "wallet",
      targetId: wallet.id,
      subjectUserId: userId,
      action: "wallet.balance.cleared",
      before: { balance: wallet.balance, locked_balance: wallet.locked_balance },
      after: { balance: 0, locked_balance: 0 },
      metadata: {
        userId,
        walletType: wallet.type,
        requestBatchId,
      },
      reason: "ユーザーソフトデリートによる残高クリア",
      retentionDays: WALLET_AUDIT_RETENTION_DAYS,
      tx,
    })),
  );
}

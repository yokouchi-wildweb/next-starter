// src/features/core/wallet/services/server/lots/sweepExpiredLots.ts
// 失効スイープ: 有効期限切れロットの残額を没収（残高減算）する cron タスク本体
//
// - sweepEnabled: true の walletType のみ対象
// - ウォレット単位で処理: 行ロック（FOR UPDATE SKIP LOCKED）→ 期限切れロットを FIFO で0化
//   → 残高を相対減算 → wallet_histories 記録 → audit（バッチ単位で集約1行）
// - 並走中のユーザー消費とはウォレット行ロックで直列化。ロック中のウォレットは
//   SKIP LOCKED で飛ばし、次回実行で回収（冪等なのでいつ再実行してもよい）
// - locked_balance 保護: 失効額は「利用可能残高（balance - locked_balance）」を上限とする。
//   上限で失効しきれなかった分はロットに残り、次回スイープに持ち越される
// - id カーソルで前進を保証（上限保護で失効できないウォレットがあっても無限ループしない）

import { and, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { WalletTable, WalletLotTable } from "@/features/core/wallet/entities/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { runAsSystem } from "@/lib/audit";
import { getSweepEnabledWalletTypes } from "@/features/core/wallet/utils/expiration";
import { resolveRequestBatchId } from "../wrappers/utils";
import type { Wallet } from "@/features/core/wallet/entities";

/** 1トランザクションで処理するウォレット数 */
const DEFAULT_BATCH_SIZE = 500;

/** 1回の実行で処理する最大バッチ数（残りは次回実行に持ち越し） */
const DEFAULT_MAX_ITERATIONS = 100;

/** ウォレット系 audit retention（コンプライアンス対応で 2 年） */
const WALLET_AUDIT_RETENTION_DAYS = 730;

export type SweepExpiredLotsOptions = {
  batchSize?: number;
  maxIterations?: number;
};

export type SweepExpiredLotsResult = {
  /** 失効処理したウォレット数 */
  sweptWallets: number;
  /** 没収した合計額 */
  expiredAmount: number;
  iterations: number;
  /** 上限到達で打ち切られた場合 true（次回 cron で残りを処理） */
  truncated: boolean;
};

type WalletSweepPlan = {
  wallet: Wallet;
  /** 今回失効させる額（利用可能残高でキャップ済み） */
  expired: number;
  /** remaining を 0 にするロット id */
  fullZeroLotIds: string[];
  /** 境界ロットの部分減算 */
  partial: { lotId: string; newRemaining: number } | null;
};

/**
 * 期限切れロットを没収する。冪等・再実行安全。
 * 推奨スケジュール: 1日1回（深夜帯）
 */
export async function sweepExpiredWalletLots(
  options: SweepExpiredLotsOptions = {},
): Promise<SweepExpiredLotsResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const sweepTypes = getSweepEnabledWalletTypes();

  if (sweepTypes.length === 0) {
    return { sweptWallets: 0, expiredAmount: 0, iterations: 0, truncated: false };
  }

  return runAsSystem(async () => {
    const requestBatchId = resolveRequestBatchId(null);

    let sweptWallets = 0;
    let expiredAmount = 0;
    let iterations = 0;
    let cursor: string | null = null;
    let hasMore = true;

    while (hasMore && iterations < maxIterations) {
      const batch = await db.transaction(async (trx) => {
        // 1. 期限切れロットを持つウォレットを行ロックで確保（使用中のウォレットはスキップ）
        const conditions = [
          inArray(WalletTable.type, sweepTypes),
          sql`EXISTS (
            SELECT 1 FROM ${WalletLotTable}
            WHERE ${WalletLotTable.wallet_id} = ${WalletTable.id}
              AND ${WalletLotTable.remaining} > 0
              AND ${WalletLotTable.expires_at} < NOW()
          )`,
        ];
        if (cursor) {
          conditions.push(gt(WalletTable.id, cursor));
        }

        const wallets = (await trx
          .select()
          .from(WalletTable)
          .where(and(...conditions))
          .orderBy(WalletTable.id)
          .limit(batchSize)
          .for("update", { of: WalletTable, skipLocked: true })) as Wallet[];

        if (wallets.length === 0) {
          return { swept: 0, expired: 0, lastId: null, hasMore: false };
        }

        const lastId = wallets[wallets.length - 1]!.id;
        const walletIds = wallets.map((w) => w.id);

        // 2. 対象ウォレットの期限切れロットを FIFO 順で取得
        const expiredLots = await trx
          .select({
            id: WalletLotTable.id,
            wallet_id: WalletLotTable.wallet_id,
            remaining: WalletLotTable.remaining,
          })
          .from(WalletLotTable)
          .where(
            and(
              inArray(WalletLotTable.wallet_id, walletIds),
              gt(WalletLotTable.remaining, 0),
              sql`${WalletLotTable.expires_at} < NOW()`,
            ),
          )
          .orderBy(
            WalletLotTable.wallet_id,
            WalletLotTable.expires_at,
            WalletLotTable.createdAt,
            WalletLotTable.id,
          );

        const lotsByWallet = new Map<string, typeof expiredLots>();
        for (const lot of expiredLots) {
          const list = lotsByWallet.get(lot.wallet_id) ?? [];
          list.push(lot);
          lotsByWallet.set(lot.wallet_id, list);
        }

        // 3. ウォレットごとに失効額を計算（利用可能残高でキャップ）
        const plans: WalletSweepPlan[] = [];
        for (const wallet of wallets) {
          const lots = lotsByWallet.get(wallet.id) ?? [];
          let capLeft = Math.max(0, wallet.balance - wallet.locked_balance);
          let expired = 0;
          const fullZeroLotIds: string[] = [];
          let partial: WalletSweepPlan["partial"] = null;

          for (const lot of lots) {
            if (capLeft <= 0) break;
            const take = Math.min(lot.remaining, capLeft);
            capLeft -= take;
            expired += take;
            if (take === lot.remaining) {
              fullZeroLotIds.push(lot.id);
            } else {
              partial = { lotId: lot.id, newRemaining: lot.remaining - take };
            }
          }

          if (expired > 0) {
            plans.push({ wallet, expired, fullZeroLotIds, partial });
          }
        }

        if (plans.length === 0) {
          return { swept: 0, expired: 0, lastId, hasMore: wallets.length === batchSize };
        }

        // 4. ロット更新（全消化は一括0化、境界ロットは個別に部分減算）
        const allFullZeroIds = plans.flatMap((p) => p.fullZeroLotIds);
        if (allFullZeroIds.length > 0) {
          await trx
            .update(WalletLotTable)
            .set({ remaining: 0 })
            .where(inArray(WalletLotTable.id, allFullZeroIds));
        }
        for (const plan of plans) {
          if (plan.partial) {
            await trx
              .update(WalletLotTable)
              .set({ remaining: plan.partial.newRemaining })
              .where(sql`${WalletLotTable.id} = ${plan.partial.lotId}`);
          }
        }

        // 5. 残高を相対減算（VALUES 結合で1文。行ロック保持中なので安全）
        const valuesList = sql.join(
          plans.map((p) => sql`(${p.wallet.id}::uuid, ${p.expired}::int)`),
          sql`, `,
        );
        await trx.execute(sql`
          UPDATE ${WalletTable} AS w
          SET balance = w.balance - v.expired, updated_at = NOW()
          FROM (VALUES ${valuesList}) AS v(id, expired)
          WHERE w.id = v.id
        `);

        // 6. wallet_histories 記録（ユーザー向け履歴に「有効期限切れ」として表示される）
        await trx.insert(WalletHistoryTable).values(
          plans.map((p) => ({
            user_id: p.wallet.user_id,
            type: p.wallet.type,
            change_method: "DECREMENT" as const,
            points_delta: p.expired,
            balance_before: p.wallet.balance,
            balance_after: p.wallet.balance - p.expired,
            source_type: "system" as const,
            request_batch_id: requestBatchId,
            reason: "有効期限切れによる失効",
            reason_category: "expiration" as const,
            meta: {},
          })),
        );

        // 7. 「介入」ログ: バッチ単位で1行集約（対象が大量になり得るため detail ではなく aggregate）
        await auditLogger.record({
          targetType: "wallet",
          targetId: requestBatchId,
          // バッチ集約行のため対象ユーザーは特定しない（個別の失効は wallet_histories に per-user で残る）
          subjectUserId: null,
          action: "wallet.balance.expired",
          metadata: {
            walletTypes: sweepTypes,
            sweptWallets: plans.length,
            expiredAmount: plans.reduce((total, p) => total + p.expired, 0),
            requestBatchId,
          },
          reason: "有効期限切れロットの定期失効スイープ",
          retentionDays: WALLET_AUDIT_RETENTION_DAYS,
          tx: trx,
        });

        return {
          swept: plans.length,
          expired: plans.reduce((total, p) => total + p.expired, 0),
          lastId,
          hasMore: wallets.length === batchSize,
        };
      });

      sweptWallets += batch.swept;
      expiredAmount += batch.expired;
      iterations += 1;
      hasMore = batch.hasMore;
      cursor = batch.lastId;
    }

    return {
      sweptWallets,
      expiredAmount,
      iterations,
      truncated: hasMore && iterations >= maxIterations,
    };
  });
}

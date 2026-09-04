// src/features/core/couponAttributionReward/services/server/grant.ts
//
// 帰属報酬の付与。クーポン消込 1 件（coupon_histories 1 行）に対して、
// 発行者（coupon.attribution_user_id）へウォレット報酬を 1 回だけ付与し、台帳に記録する。
//
// 設計:
//  - 冪等キー = coupon_history_id。同じ消込で何度呼んでも付与は 1 回
//  - 呼び出し側 tx（購入完了 tx 等）に乗せられる。乗せた場合も、内部を SAVEPOINT で
//    囲むことで付与失敗が外側 tx を abort させない（failed 行を残して外側は続行）
//  - 金額・通貨の決定は呼び出し側（下流ハンドラー）の責務。ここは「渡された額を安全に付与する」だけ
//  - 通知は内蔵しない（通知テーブルは tx に乗らず、外側ロールバック時に不整合になるため）。
//    呼び出し側が tx コミット後に sendToUserSafe 等で送る（README レシピ参照）

import { and, eq, sql } from "drizzle-orm";

import { runWithTransaction, type TransactionClient } from "@/lib/drizzle/transaction";
import { markUserDirty } from "@/lib/userDirty";
import { DomainError } from "@/lib/errors/domainError";
import { walletService } from "@/features/core/wallet/services/server/walletService";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import type { ReasonCategory } from "@/config/app/wallet-reason-category.config";
import type { Coupon } from "@/features/core/coupon/entities/model";
import type { CouponHistory } from "@/features/core/couponHistory/entities/model";
import { CouponAttributionRewardTable } from "@/features/core/couponAttributionReward/entities/drizzle";
import type { CouponAttributionReward } from "@/features/core/couponAttributionReward/entities/model";

export type GrantAttributionRewardParams = {
  /** 消込されたクーポン（attribution_user_id が受取人になる） */
  coupon: Coupon;
  /** 消込の履歴行（id が冪等キー） */
  couponHistory: CouponHistory;
  /** 付与額（通貨最小単位の整数、0 以下は skipped） */
  amount: number;
  walletType: WalletTypeValue;
  /** wallet_histories.reason（省略時は既定文言） */
  reason?: string;
  /** 省略時 "bonus" */
  reasonCategory?: ReasonCategory;
  /** 台帳 metadata（rate / purchaseAmount 等、集計・表示用の任意情報） */
  metadata?: Record<string, unknown>;
};

export type GrantAttributionRewardResult =
  | { status: "fulfilled"; reward: CouponAttributionReward }
  | { status: "already_fulfilled"; reward: CouponAttributionReward }
  | { status: "failed"; reward: CouponAttributionReward; error: unknown }
  | { status: "skipped"; reason: "no_recipient" | "self_attribution" | "zero_amount" };

const DEFAULT_REASON = "クーポン帰属報酬";

/**
 * 帰属報酬を付与する（冪等・tx 対応・失敗隔離）
 *
 * @param params 付与パラメータ
 * @param tx 外部トランザクション（購入完了 tx 等）。省略時は自前で tx を開く
 */
export async function grantAttributionReward(
  params: GrantAttributionRewardParams,
  tx?: TransactionClient,
): Promise<GrantAttributionRewardResult> {
  const recipientUserId = params.coupon.attribution_user_id;
  if (!recipientUserId) {
    return { status: "skipped", reason: "no_recipient" };
  }
  // 基底検証（self_redeem_forbidden）で弾かれる前提だが、直接呼び出し経路の防御として二重に閉じる
  if (params.couponHistory.redeemer_user_id === recipientUserId) {
    return { status: "skipped", reason: "self_attribution" };
  }
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    return { status: "skipped", reason: "zero_amount" };
  }

  return runWithTransaction(tx, async (trx) => {
    // 1. 台帳行を確保（冪等キーで衝突したら既存行を使う）
    await trx
      .insert(CouponAttributionRewardTable)
      .values({
        coupon_id: params.coupon.id,
        coupon_history_id: params.couponHistory.id,
        recipient_user_id: recipientUserId,
        redeemer_user_id: params.couponHistory.redeemer_user_id ?? null,
        wallet_type: params.walletType,
        amount: params.amount,
        status: "pending",
        metadata: params.metadata ?? {},
      })
      .onConflictDoNothing({ target: CouponAttributionRewardTable.coupon_history_id });

    const [row] = await trx
      .select()
      .from(CouponAttributionRewardTable)
      .where(eq(CouponAttributionRewardTable.coupon_history_id, params.couponHistory.id))
      .for("update");
    const reward = row as CouponAttributionReward;

    if (reward.status === "fulfilled") {
      return { status: "already_fulfilled", reward };
    }

    // 2. 付与（SAVEPOINT 隔離）
    return fulfillRewardRow(trx, reward, {
      reason: params.reason ?? DEFAULT_REASON,
      reasonCategory: params.reasonCategory ?? "bonus",
    });
  });
}

/**
 * failed / pending の台帳行に対して付与を再試行する（運用回復用）
 *
 * 台帳に保存された amount / wallet_type / recipient で再付与する。
 * fulfilled 行に対しては already_fulfilled を返し、二重付与しない。
 */
export async function retryAttributionReward(
  rewardId: string,
  tx?: TransactionClient,
): Promise<Exclude<GrantAttributionRewardResult, { status: "skipped" }>> {
  return runWithTransaction(tx, async (trx) => {
    const [row] = await trx
      .select()
      .from(CouponAttributionRewardTable)
      .where(eq(CouponAttributionRewardTable.id, rewardId))
      .for("update");
    if (!row) {
      throw new DomainError("帰属報酬が見つかりません", { status: 404 });
    }
    const reward = row as CouponAttributionReward;
    if (reward.status === "fulfilled") {
      return { status: "already_fulfilled", reward };
    }
    return fulfillRewardRow(trx, reward, {
      reason: DEFAULT_REASON,
      reasonCategory: "bonus",
    });
  });
}

/**
 * 台帳行 1 件に対するウォレット付与 + 状態確定。
 *
 * SAVEPOINT で囲み、adjustBalance 内の SQL エラー等で外側 tx が abort 状態に
 * ならないようにする。失敗時は ROLLBACK TO の後に failed を記録して返す（throw しない）。
 */
async function fulfillRewardRow(
  trx: TransactionClient,
  reward: CouponAttributionReward,
  options: { reason: string; reasonCategory: ReasonCategory },
): Promise<Exclude<GrantAttributionRewardResult, { status: "skipped" }>> {
  const savepoint = `coupon_attr_reward_${reward.id.replace(/-/g, "_")}`;
  try {
    await trx.execute(sql.raw(`SAVEPOINT ${savepoint}`));

    const walletResult = await walletService.adjustBalance(
      {
        userId: reward.recipient_user_id,
        walletType: reward.wallet_type,
        changeMethod: "INCREMENT",
        amount: reward.amount,
        sourceType: "system",
        requestBatchId: reward.coupon_history_id,
        reason: options.reason,
        reasonCategory: options.reasonCategory,
        meta: {
          couponId: reward.coupon_id,
          couponHistoryId: reward.coupon_history_id,
          couponAttributionRewardId: reward.id,
        },
      },
      trx,
    );

    const [updated] = await trx
      .update(CouponAttributionRewardTable)
      .set({
        status: "fulfilled",
        wallet_history_id: walletResult.history?.id ?? null,
        fulfilled_at: sql`now()`,
        failure_reason: null,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(CouponAttributionRewardTable.id, reward.id),
          eq(CouponAttributionRewardTable.status, reward.status),
        ),
      )
      .returning();

    await trx.execute(sql.raw(`RELEASE SAVEPOINT ${savepoint}`));

    // 受取人の派生値（残高キャッシュ等）をコミット後再計算対象にする
    markUserDirty(reward.recipient_user_id);

    return { status: "fulfilled", reward: updated as CouponAttributionReward };
  } catch (error) {
    try {
      await trx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepoint}`));
    } catch (rollbackError) {
      console.error("[couponAttributionReward] SAVEPOINT ロールバック失敗:", rollbackError);
    }
    console.error(
      `[couponAttributionReward] 付与失敗: rewardId=${reward.id}, recipient=${reward.recipient_user_id}`,
      error,
    );
    const [failed] = await trx
      .update(CouponAttributionRewardTable)
      .set({
        status: "failed",
        failure_reason: String(error instanceof Error ? error.message : error).slice(0, 4000),
        updatedAt: sql`now()`,
      })
      .where(eq(CouponAttributionRewardTable.id, reward.id))
      .returning();
    return { status: "failed", reward: failed as CouponAttributionReward, error };
  }
}

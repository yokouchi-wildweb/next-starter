// 個別の報酬を配布する

import { db } from "@/lib/drizzle";
import { ReferralRewardTable } from "../../../entities/drizzle";
import type { ReferralReward } from "../../../entities/model";
import type { Referral } from "@/features/core/referral/entities/model";
import { REFERRAL_REWARD_DEFINITIONS } from "../../../config";
import { getRewardHandler } from "../rewardHandlerRegistry";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * 報酬配布結果
 */
export type FulfillResult =
  | { success: true; reward: ReferralReward }
  | { success: false; reason: "already_fulfilled" | "no_handler" | "no_definition" | "handler_error"; error?: unknown };

/**
 * 指定した reward_key の報酬を配布する
 *
 * - 既に fulfilled の場合はスキップ（冪等性）
 * - ハンドラー未登録の場合は pending のまま作成（下流で後から処理可能）
 * - ハンドラーが登録されている場合は実行し、fulfilled に更新
 *
 * @param rewardKey 報酬キー
 * @param referral 紹介レコード
 * @param context トリガーイベントのコンテキスト情報（オプション）
 * @param tx トランザクション（オプション）
 */
export async function fulfillReward(
  rewardKey: string,
  referral: Referral,
  context?: Record<string, unknown>,
  tx?: TransactionClient,
): Promise<FulfillResult> {
  const definition = REFERRAL_REWARD_DEFINITIONS[rewardKey];
  if (!definition) {
    return { success: false, reason: "no_definition" };
  }

  const executor = tx ?? db;

  // 受取人を決定
  const recipientUserId =
    definition.recipientRole === "inviter"
      ? referral.inviter_user_id
      : referral.invitee_user_id;

  // 既存チェック
  const existing = await executor
    .select()
    .from(ReferralRewardTable)
    .where(
      and(
        eq(ReferralRewardTable.referral_id, referral.id),
        eq(ReferralRewardTable.reward_key, rewardKey),
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0] as ReferralReward;
    if (row.status === "fulfilled") {
      return { success: false, reason: "already_fulfilled" };
    }
  }

  // ハンドラー取得
  const handler = getRewardHandler(rewardKey);

  if (!handler) {
    // ハンドラー未登録 → pending で作成のみ（下流で後から処理可能）
    if (existing.length === 0) {
      const [created] = await executor
        .insert(ReferralRewardTable)
        .values({
          referral_id: referral.id,
          reward_key: rewardKey,
          recipient_user_id: recipientUserId,
          status: "pending",
        })
        .returning();
      return { success: true, reward: created as ReferralReward };
    }
    return { success: false, reason: "no_handler" };
  }

  // ハンドラー実行
  try {
    const metadata = await handler({ referral, rewardKey, recipientUserId, context, tx });

    if (existing.length > 0) {
      // 既存レコードを fulfilled に更新
      const [updated] = await executor
        .update(ReferralRewardTable)
        .set({
          status: "fulfilled",
          fulfilled_at: sql`now()`,
          metadata,
          updatedAt: sql`now()`,
        })
        .where(eq(ReferralRewardTable.id, (existing[0] as ReferralReward).id))
        .returning();
      return { success: true, reward: updated as ReferralReward };
    }

    // 新規作成（fulfilled）
    const [created] = await executor
      .insert(ReferralRewardTable)
      .values({
        referral_id: referral.id,
        reward_key: rewardKey,
        recipient_user_id: recipientUserId,
        status: "fulfilled",
        fulfilled_at: sql`now()`,
        metadata,
      })
      .returning();
    return { success: true, reward: created as ReferralReward };
  } catch (error) {
    // ハンドラーエラー → failed で記録
    if (existing.length > 0) {
      await executor
        .update(ReferralRewardTable)
        .set({
          status: "failed",
          metadata: { error: String(error) },
          updatedAt: sql`now()`,
        })
        .where(eq(ReferralRewardTable.id, (existing[0] as ReferralReward).id));
    } else {
      await executor
        .insert(ReferralRewardTable)
        .values({
          referral_id: referral.id,
          reward_key: rewardKey,
          recipient_user_id: recipientUserId,
          status: "failed",
          metadata: { error: String(error) },
        });
    }
    return { success: false, reason: "handler_error", error };
  }
}

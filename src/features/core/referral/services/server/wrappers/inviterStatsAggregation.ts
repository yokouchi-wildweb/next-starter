// 招待者（inviter）別の紹介人数・報酬集計の共通 SQL 部品
//
// getInviteCodeListWithCounts（クーポンキーの一覧）と getStatsByInviters（userId キーの一括取得）が
// 同じ集計意味論を共有するための単一ソース。集計の定義を変える場合は必ずここを変更する。
//
// - referralCount: referrals.status='active' の inviter 別件数
// - rewardedReferralCount: fulfilled かつ recipient=inviter の referral_rewards から COUNT(DISTINCT referral.id)
// - totalRewardAmount: 同スコープの metadata.amount（数値安全化）の SUM
// - stage{i}: 段階 i の inviter 向け reward_key に一致する fulfilled 報酬の COUNT(DISTINCT referral.id)
//
// Drizzle のサブクエリはクエリごとに生成する必要があるため、定数ではなくファクトリ関数で提供する。

import { db } from "@/lib/drizzle";
import { ReferralTable } from "../../../entities/drizzle";
import { ReferralRewardTable } from "@/features/core/referralReward/entities/drizzle";
import { REFERRAL_REWARD_DEFINITIONS } from "@/features/core/referralReward/config";
import { and, eq, sql, count as drizzleCount, countDistinct } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

/** リワード段階（報酬グループ）のメタ情報 */
export type InviteRewardStage = {
  /** REFERRAL_REWARD_DEFINITIONS のグループキー */
  groupKey: string;
  /** グループ表示名 */
  label: string;
};

/** 段階メタ情報 + 発動判定に使う inviter 向け reward_key */
export type InviteRewardStageDef = InviteRewardStage & { rewardKey: string };

/**
 * REFERRAL_REWARD_DEFINITIONS から段階一覧を解決する
 * （各グループの inviter 向け reward_key を発動判定キーとする）
 */
export function resolveRewardStages(): InviteRewardStageDef[] {
  return Object.entries(REFERRAL_REWARD_DEFINITIONS).flatMap(([groupKey, group]) => {
    const inviterEntry = Object.entries(group.rewards).find(
      ([, def]) => def.recipientRole === "inviter",
    );
    if (!inviterEntry) return [];
    return [{ groupKey, label: group.label, rewardKey: inviterEntry[0] }];
  });
}

/** metadata.amount の安全な数値化（数値として解釈できない値は 0 扱い） */
export const rewardAmountExpr = sql`CASE WHEN ${ReferralRewardTable.metadata}->>'amount' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${ReferralRewardTable.metadata}->>'amount')::numeric ELSE 0 END`;

/** 報酬集計の共通スコープ: fulfilled かつ受取人が招待者本人 */
export const inviterRewardScope = () =>
  and(
    eq(ReferralRewardTable.status, "fulfilled"),
    eq(ReferralRewardTable.recipient_user_id, ReferralTable.inviter_user_id),
  );

/**
 * 紹介人数（inviter 別）のサブクエリを生成する
 * @param extraWhere inviter 絞り込み等の追加条件（referrals 列に対する条件）
 */
export function buildReferralCountSubquery(extraWhere?: SQL) {
  return db
    .select({
      inviter_user_id: ReferralTable.inviter_user_id,
      count: drizzleCount().as("referral_count"),
    })
    .from(ReferralTable)
    .where(and(eq(ReferralTable.status, "active"), extraWhere))
    .groupBy(ReferralTable.inviter_user_id)
    .as("rc");
}

/**
 * 報酬集計（inviter 別）のサブクエリを生成する。
 * 段階別カウントは FILTER 句で同一クエリ内に展開する（stageDefs が空なら基本 2 列のみ）。
 *
 * 列: inviter_user_id / rewardedReferralCount / totalRewardAmount / stage{i}
 * 列は動的なため、参照は rewardSubqueryColumn() 経由で行う。
 *
 * @param stageDefs 段階定義（resolveRewardStages() の結果、または不要なら []）
 * @param extraWhere inviter 絞り込み等の追加条件（referrals 列に対する条件）
 */
export function buildRewardSubquery(stageDefs: InviteRewardStageDef[], extraWhere?: SQL) {
  const rewardSelect: Record<string, SQL.Aliased | typeof ReferralTable.inviter_user_id> = {
    inviter_user_id: ReferralTable.inviter_user_id,
    rewardedReferralCount: countDistinct(ReferralTable.id).as("rewarded_referral_count"),
    totalRewardAmount: sql`COALESCE(SUM(${rewardAmountExpr}), 0)`.as("total_reward_amount"),
  };
  stageDefs.forEach((stage, i) => {
    rewardSelect[`stage${i}`] = sql`COUNT(DISTINCT ${ReferralTable.id}) FILTER (WHERE ${ReferralRewardTable.reward_key} = ${stage.rewardKey})`.as(`stage_rewarded_${i}`);
  });

  return db
    .select(rewardSelect)
    .from(ReferralRewardTable)
    .innerJoin(ReferralTable, eq(ReferralRewardTable.referral_id, ReferralTable.id))
    .where(and(inviterRewardScope(), extraWhere))
    .groupBy(ReferralTable.inviter_user_id)
    .as("rw");
}

export type RewardSubquery = ReturnType<typeof buildRewardSubquery>;

/** buildRewardSubquery の動的列（rewardedReferralCount / totalRewardAmount / stage{i}）を参照する */
export function rewardSubqueryColumn(rewardSq: RewardSubquery, key: string): SQL.Aliased {
  return (rewardSq as unknown as Record<string, SQL.Aliased>)[key];
}

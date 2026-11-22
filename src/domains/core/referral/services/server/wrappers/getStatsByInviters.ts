// 指定ユーザー群の招待実績（紹介人数・リワード対象人数・リワード合計金額）を一括取得する
//
// getInviteCodeListWithCounts（クーポンキーの一覧）と同じ集計意味論を userId キーで返す。
// ユーザー一覧に招待実績カラムを付ける用途（審査画面・ユーザーハブ・セグメント等）向け。
// 集計式は inviterStatsAggregation.ts を共有しており、ここで独自定義はしない。
//
// 紹介数と報酬集計は別サブクエリで取得して JS 側でマージする。cancelled な紹介しか持たない
// 招待者にも fulfilled 報酬が存在し得るため（既存一覧と同じ意味論）、片側起点の JOIN では
// 取りこぼしが発生するのを避ける目的。

import { db } from "@/lib/drizzle";
import { ReferralTable } from "../../../entities/drizzle";
import { buildReferralCountSubquery, buildRewardSubquery } from "./inviterStatsAggregation";
import { inArray } from "drizzle-orm";

/** 招待者 1 人分の招待実績 */
export type ReferralInviterStats = {
  /** 紹介人数（status='active' の referral 数） */
  referralCount: number;
  /** リワードを受け取った対象人数（fulfilled 報酬を持つユニーク referral 数） */
  rewardedReferralCount: number;
  /** 受け取ったリワード合計金額（referral_rewards.metadata.amount の合計） */
  totalRewardAmount: number;
};

/** 1 回の SQL に含める inviter ID の上限（バインドパラメータ数を有界に保つ） */
const CHUNK_SIZE = 200;

const ZERO_STATS: ReferralInviterStats = {
  referralCount: 0,
  rewardedReferralCount: 0,
  totalRewardAmount: 0,
};

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/**
 * 指定ユーザー群の招待実績を一括取得する。
 * 入力は重複排除され、実績のないユーザーも 0 埋めで必ずキーに含まれる。
 * 内部で CHUNK_SIZE 件ずつ分割して問い合わせるため、呼び出し側に件数上限はない。
 */
export async function getStatsByInviters(
  userIds: string[],
): Promise<Record<string, ReferralInviterStats>> {
  const uniqueIds = [...new Set(userIds)];
  const result: Record<string, ReferralInviterStats> = {};
  for (const id of uniqueIds) result[id] = { ...ZERO_STATS };
  if (uniqueIds.length === 0) return result;

  for (const ids of chunk(uniqueIds, CHUNK_SIZE)) {
    const inviterFilter = inArray(ReferralTable.inviter_user_id, ids);
    const referralCountSq = buildReferralCountSubquery(inviterFilter);
    const rewardSq = buildRewardSubquery([], inviterFilter);

    const [referralRows, rewardRows] = await Promise.all([
      db.select().from(referralCountSq),
      db.select().from(rewardSq),
    ]);

    for (const row of referralRows as Array<Record<string, unknown>>) {
      const id = row.inviter_user_id as string;
      result[id].referralCount = Number(row.count ?? 0);
    }
    for (const row of rewardRows as Array<Record<string, unknown>>) {
      const id = row.inviter_user_id as string;
      result[id].rewardedReferralCount = Number(row.rewardedReferralCount ?? 0);
      result[id].totalRewardAmount = Number(row.totalRewardAmount ?? 0);
    }
  }

  return result;
}

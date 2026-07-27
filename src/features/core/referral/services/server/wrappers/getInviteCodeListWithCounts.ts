// 招待コード発行者一覧 + 紹介人数・報酬集計を返す（管理画面用）
//
// 一覧はサーバーページネーションのため、並び替えは SQL 側で全行を対象に行う。
// 集計（紹介人数・報酬統計・段階別発動数）はすべて main クエリに LEFT JOIN した
// grouped subquery で計算し、ORDER BY から参照できるようにしている。

import { db } from "@/lib/drizzle";
import { CouponTable } from "@/features/core/coupon/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { ReferralTable } from "../../../entities/drizzle";
import { ReferralRewardTable } from "@/features/core/referralReward/entities/drizzle";
import { REFERRAL_REWARD_DEFINITIONS } from "@/features/core/referralReward/config";
import type { Coupon } from "@/features/core/coupon/entities/model";
import type { SortState } from "@/lib/tableSuite";
import { and, eq, isNull, sql, asc, desc, ilike, count as drizzleCount, countDistinct } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

export type InviteCodeWithCount = {
  coupon: Coupon;
  referralCount: number;
  issuerName: string | null;
  /** この招待者がリワードを受け取った対象人数（ユニーク referral 数） */
  rewardedReferralCount: number;
  /** この招待者が受け取ったリワード合計金額（metadata.amount の合計） */
  totalRewardAmount: number;
  /** 段階（報酬グループ）ごとの発動済みユニーク referral 数（stages と同じ並び） */
  stageRewardedCounts: number[];
};

/** リワード段階（報酬グループ）のメタ情報 */
export type InviteRewardStage = {
  /** REFERRAL_REWARD_DEFINITIONS のグループキー */
  groupKey: string;
  /** グループ表示名 */
  label: string;
};

/**
 * ソートキー:
 * - `referralCount`: 紹介人数
 * - `rewardedReferralCount`: 報酬発動済みユニーク referral 数
 * - `totalRewardAmount`: 報酬合計金額
 * - `stageRate{i}`: 段階 i の発動率（stages[i] に対応。発動数 / 紹介人数）
 * 不明なキーは無視され、既定ソート（referralCount desc）にフォールバックする。
 */
export type GetInviteCodeListParams = {
  page?: number;
  limit?: number;
  searchQuery?: string;
  sort?: SortState;
};

export type GetInviteCodeListResult = {
  items: InviteCodeWithCount[];
  total: number;
  /** 全招待者のリワード合計金額（ページに関わらず全体） */
  grandTotalRewardAmount: number;
  /** リワード段階の一覧（定義順。items[].stageRewardedCounts と対応） */
  stages: InviteRewardStage[];
};

/**
 * REFERRAL_REWARD_DEFINITIONS から段階一覧を解決する
 * （各グループの inviter 向け reward_key を発動判定キーとする）
 */
function resolveRewardStages(): Array<InviteRewardStage & { rewardKey: string }> {
  return Object.entries(REFERRAL_REWARD_DEFINITIONS).flatMap(([groupKey, group]) => {
    const inviterEntry = Object.entries(group.rewards).find(
      ([, def]) => def.recipientRole === "inviter",
    );
    if (!inviterEntry) return [];
    return [{ groupKey, label: group.label, rewardKey: inviterEntry[0] }];
  });
}

// metadata.amount の安全な数値化（数値として解釈できない値は 0 扱い）
const rewardAmountExpr = sql`CASE WHEN ${ReferralRewardTable.metadata}->>'amount' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${ReferralRewardTable.metadata}->>'amount')::numeric ELSE 0 END`;

/**
 * 招待コード（type='invite'）の一覧を取得し、各発行者の紹介人数・報酬集計を返す
 */
export async function getInviteCodeListWithCounts(
  params: GetInviteCodeListParams = {},
): Promise<GetInviteCodeListResult> {
  const { page = 1, limit = 20, searchQuery, sort } = params;
  const offset = (page - 1) * limit;

  const stageDefs = resolveRewardStages();
  const stages: InviteRewardStage[] = stageDefs.map(({ groupKey, label }) => ({ groupKey, label }));

  // invite型クーポンの検索条件
  const baseConditions = [
    eq(CouponTable.type, "invite"),
    isNull(CouponTable.deletedAt),
  ];

  // テキスト検索（招待コードで検索）
  if (searchQuery) {
    const pattern = `%${searchQuery}%`;
    baseConditions.push(ilike(CouponTable.code, pattern));
  }

  const whereClause = and(...baseConditions);

  // 件数取得
  const [{ value: total }] = await db
    .select({ value: drizzleCount() })
    .from(CouponTable)
    .where(whereClause);

  // 紹介人数（inviter 別）のサブクエリ
  const referralCountSq = db
    .select({
      inviter_user_id: ReferralTable.inviter_user_id,
      count: drizzleCount().as("referral_count"),
    })
    .from(ReferralTable)
    .where(eq(ReferralTable.status, "active"))
    .groupBy(ReferralTable.inviter_user_id)
    .as("rc");

  // 報酬集計（inviter 別）のサブクエリ。段階別カウントは FILTER 句で同一クエリ内に展開
  const rewardSelect: Record<string, SQL.Aliased | typeof ReferralTable.inviter_user_id> = {
    inviter_user_id: ReferralTable.inviter_user_id,
    rewardedReferralCount: countDistinct(ReferralTable.id).as("rewarded_referral_count"),
    totalRewardAmount: sql`COALESCE(SUM(${rewardAmountExpr}), 0)`.as("total_reward_amount"),
  };
  stageDefs.forEach((stage, i) => {
    rewardSelect[`stage${i}`] = sql`COUNT(DISTINCT ${ReferralTable.id}) FILTER (WHERE ${ReferralRewardTable.reward_key} = ${stage.rewardKey})`.as(`stage_rewarded_${i}`);
  });

  const rewardSq = db
    .select(rewardSelect)
    .from(ReferralRewardTable)
    .innerJoin(ReferralTable, eq(ReferralRewardTable.referral_id, ReferralTable.id))
    .where(
      and(
        eq(ReferralRewardTable.status, "fulfilled"),
        eq(ReferralRewardTable.recipient_user_id, ReferralTable.inviter_user_id),
      ),
    )
    .groupBy(ReferralTable.inviter_user_id)
    .as("rw");

  const rewardCol = (key: string) =>
    (rewardSq as unknown as Record<string, SQL.Aliased>)[key];

  const referralCountExpr = sql`COALESCE(${referralCountSq.count}, 0)`;

  // ソートキー → ORDER BY 式の解決（不明キーは null = 既定ソート）
  const resolveSortExpr = (state: SortState | undefined): SQL | null => {
    if (!state) return null;
    if (state.field === "referralCount") return referralCountExpr;
    if (state.field === "rewardedReferralCount") {
      return sql`COALESCE(${rewardCol("rewardedReferralCount")}, 0)`;
    }
    if (state.field === "totalRewardAmount") {
      return sql`COALESCE(${rewardCol("totalRewardAmount")}, 0)`;
    }
    const stageMatch = state.field.match(/^stageRate(\d+)$/);
    if (stageMatch) {
      const index = Number(stageMatch[1]);
      if (index < stageDefs.length) {
        // 発動率 = 段階発動数 / 紹介人数（紹介 0 人はゼロ除算回避で 0 扱い）
        return sql`COALESCE(COALESCE(${rewardCol(`stage${index}`)}, 0)::float / NULLIF(${referralCountExpr}, 0), 0)`;
      }
    }
    return null;
  };

  const sortExpr = resolveSortExpr(sort);
  const orderBy: SQL[] =
    sortExpr && sort
      ? [sort.direction === "asc" ? asc(sortExpr) : desc(sortExpr), desc(CouponTable.createdAt)]
      : [desc(referralCountExpr), desc(CouponTable.createdAt)];

  // 一覧取得（集計を LEFT JOIN で結合し、ORDER BY から参照可能にする）
  const listSelect: Record<string, unknown> = {
    coupon: CouponTable,
    issuerName: UserTable.name,
    referralCount: referralCountExpr,
    rewardedReferralCount: sql`COALESCE(${rewardCol("rewardedReferralCount")}, 0)`,
    totalRewardAmount: sql`COALESCE(${rewardCol("totalRewardAmount")}, 0)`,
  };
  stageDefs.forEach((_, i) => {
    listSelect[`stage${i}`] = sql`COALESCE(${rewardCol(`stage${i}`)}, 0)`;
  });

  const rows = await db
    .select(listSelect as Record<string, SQL>)
    .from(CouponTable)
    .leftJoin(referralCountSq, eq(CouponTable.attribution_user_id, referralCountSq.inviter_user_id))
    .leftJoin(rewardSq, eq(CouponTable.attribution_user_id, rewardSq.inviter_user_id))
    .leftJoin(UserTable, eq(CouponTable.attribution_user_id, UserTable.id))
    .where(whereClause)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  // グランドトータル（全招待者のリワード合計、ページに関わらず）
  const [{ value: grandTotal }] = await db
    .select({ value: sql<string>`COALESCE(SUM(${rewardAmountExpr}), 0)` })
    .from(ReferralRewardTable)
    .innerJoin(ReferralTable, eq(ReferralRewardTable.referral_id, ReferralTable.id))
    .where(
      and(
        eq(ReferralRewardTable.status, "fulfilled"),
        eq(ReferralRewardTable.recipient_user_id, ReferralTable.inviter_user_id),
      ),
    );

  const items: InviteCodeWithCount[] = (rows as Array<Record<string, unknown>>).map((row) => ({
    coupon: row.coupon as Coupon,
    referralCount: Number(row.referralCount ?? 0),
    issuerName: (row.issuerName as string | null) ?? null,
    rewardedReferralCount: Number(row.rewardedReferralCount ?? 0),
    totalRewardAmount: Number(row.totalRewardAmount ?? 0),
    stageRewardedCounts: stageDefs.map((_, i) => Number(row[`stage${i}`] ?? 0)),
  }));

  return { items, total, grandTotalRewardAmount: Number(grandTotal), stages };
}

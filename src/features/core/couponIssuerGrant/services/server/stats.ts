// src/features/core/couponIssuerGrant/services/server/stats.ts
//
// 発行者プログラムの管理用リードモデル。
//
// grant 一覧に「当期クーポン / 利用数 / 帰属報酬額 / 割引総額」を付与して返す。
// 集計元は全て Tier1 所有のテーブル（coupon_issuer_grants × coupons × coupon_histories ×
// coupon_attribution_rewards × purchase_requests）で、下流が直接 SQL を書くとコア schema の
// 内部構造に結合してしまうため、ここで一元的に提供する（invite 側 getInviteCodeListWithCounts と対称）。
//
// 設計:
//  - 一覧はサーバーページネーション。集計は grouped subquery を主表（grants）に LEFT JOIN し、
//    ORDER BY から参照できるようにする（クーポン未発行の grant も 0 埋めで返る）
//  - 「当期」は registry の周期ポリシーで解決する。program 未設定時は当期系の値が null / 0 になる
//  - 集計対象クーポンは type=affiliate かつ program.category（未設定なら全 affiliate）に限定
//  - 割引総額の一次記録は purchase_requests.discount_amount（status=completed、coupon_code 結合）

import { and, asc, count as drizzleCount, desc, eq, gte, ilike, isNull, lt, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import type { SortState } from "@/lib/tableSuite";
import { CouponTable } from "@/features/core/coupon/entities/drizzle";
import { CouponHistoryTable } from "@/features/core/couponHistory/entities/drizzle";
import { CouponAttributionRewardTable } from "@/features/core/couponAttributionReward/entities/drizzle";
import type { CouponAttributionReward } from "@/features/core/couponAttributionReward/entities/model";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { CouponIssuerGrantTable } from "@/features/core/couponIssuerGrant/entities/drizzle";
import type { CouponIssuerGrant } from "@/features/core/couponIssuerGrant/entities/model";
import type { CouponIssuerGrantStatus } from "@/features/core/couponIssuerGrant/constants";
import type { IssuancePeriod } from "@/features/core/couponIssuerGrant/types/program";
import { resolveIssuancePeriod } from "@/features/core/couponIssuerGrant/utils/period";
import { getCouponIssuerProgram } from "./program";

// ============================================================================
// 型
// ============================================================================

/** 一覧・詳細に埋め込む発行者（admin 専用のため email を含む） */
export type IssuerUserSummary = {
  id: string;
  name: string | null;
  email: string | null;
};

/** 当期クーポンの要約（一覧列用） */
export type CurrentPeriodCouponSummary = {
  id: string;
  code: string;
  status: "active" | "inactive";
  current_total_uses: number;
  max_total_uses: number | null;
  valid_from: Date | null;
  valid_until: Date | null;
};

export type IssuerStats = {
  /** 当期の発行済みクーポン（program 未設定 / 未発行なら null） */
  currentPeriodCoupon: CurrentPeriodCouponSummary | null;
  /** 当期クーポンの利用数（= currentPeriodCoupon.current_total_uses、未発行なら 0） */
  currentPeriodUses: number;
  /** 発行者の全 affiliate クーポンの累計利用数（coupon_histories 件数） */
  lifetimeUses: number;
  /** 当期に付与された帰属報酬（fulfilled、fulfilled_at で区切り。program 未設定なら 0） */
  rewardPaidCurrentPeriod: number;
  /** 累計帰属報酬（fulfilled） */
  rewardPaidTotal: number;
  /** 発行者のクーポンで適用された割引総額（purchase_requests completed の discount_amount 合計） */
  discountTotal: number;
};

export type GrantWithStats = IssuerStats & {
  grant: CouponIssuerGrant;
  user: IssuerUserSummary | null;
};

/**
 * ソートキー:
 * - `requested_at`（既定 desc）| `lifetimeUses` | `currentPeriodUses` | `rewardPaidTotal` |
 *   `rewardPaidCurrentPeriod` | `discountTotal`
 * 不明なキーは無視され、既定ソートにフォールバックする。
 */
export type GetGrantListWithStatsParams = {
  status?: CouponIssuerGrantStatus | CouponIssuerGrantStatus[];
  /** 発行者の name / email 部分一致 */
  searchQuery?: string;
  page?: number;
  limit?: number;
  sort?: SortState;
};

export type GetGrantListWithStatsResult = {
  items: GrantWithStats[];
  total: number;
  /** 全 grant 横断の合計（ページ・フィルタに依存しない） */
  grandTotals: { rewardPaidTotal: number; discountTotal: number; lifetimeUses: number };
  /** 解決済みの当期区間（program 未設定なら null） */
  period: IssuancePeriod | null;
};

// ============================================================================
// 集計ソース（grouped subquery）
// ============================================================================

function resolveProgramScope() {
  const program = getCouponIssuerProgram();
  const period = program ? resolveIssuancePeriod(program.period) : null;
  const couponScope = [
    eq(CouponTable.type, "affiliate"),
    isNull(CouponTable.deletedAt),
    ...(program ? [eq(CouponTable.category, program.category)] : []),
  ];
  return { program, period, couponScope };
}

function buildStatsSources(period: IssuancePeriod | null, couponScope: SQL[]) {
  // 累計利用数（発行者別）
  const usageSq = db
    .select({
      user_id: CouponTable.attribution_user_id,
      lifetimeUses: drizzleCount(CouponHistoryTable.id).as("lifetime_uses"),
    })
    .from(CouponHistoryTable)
    .innerJoin(CouponTable, eq(CouponHistoryTable.coupon_id, CouponTable.id))
    .where(and(...couponScope))
    .groupBy(CouponTable.attribution_user_id)
    .as("usage");

  // 帰属報酬（受取人別、fulfilled のみ。当期は fulfilled_at で区切る）
  const r = CouponAttributionRewardTable;
  const inPeriod = period
    ? sql`${r.fulfilled_at} >= ${period.start.toISOString()} AND ${r.fulfilled_at} < ${period.end.toISOString()}`
    : sql`false`;
  const rewardSq = db
    .select({
      user_id: r.recipient_user_id,
      rewardPaidTotal: sql<number>`COALESCE(SUM(${r.amount}), 0)`.as("reward_paid_total"),
      rewardPaidCurrentPeriod: sql<number>`COALESCE(SUM(${r.amount}) FILTER (WHERE ${inPeriod}), 0)`.as("reward_paid_current"),
    })
    .from(r)
    .where(eq(r.status, "fulfilled"))
    .groupBy(r.recipient_user_id)
    .as("reward");

  // 割引総額（発行者別）。purchase_requests.coupon_code → coupons.code で結合
  const p = PurchaseRequestTable;
  const discountSq = db
    .select({
      user_id: CouponTable.attribution_user_id,
      discountTotal: sql<number>`COALESCE(SUM(${p.discount_amount}), 0)`.as("discount_total"),
    })
    .from(p)
    .innerJoin(CouponTable, eq(p.coupon_code, CouponTable.code))
    .where(and(eq(p.status, "completed"), ...couponScope))
    .groupBy(CouponTable.attribution_user_id)
    .as("discount");

  // 当期クーポン（発行者につき 1 件。発行ロックで 1 周期 1 枚だが、手動作成の重複に備え最新 1 件に絞る）
  // program 未設定（period=null）時は常に空になる条件にして、join 連鎖を静的に保つ
  const periodScope = period
    ? [gte(CouponTable.valid_from, period.start), lt(CouponTable.valid_from, period.end)]
    : [sql`false`];
  const currentCouponSq = db
    .selectDistinctOn([CouponTable.attribution_user_id], {
      user_id: CouponTable.attribution_user_id,
      id: CouponTable.id,
      code: CouponTable.code,
      status: CouponTable.status,
      current_total_uses: CouponTable.current_total_uses,
      max_total_uses: CouponTable.max_total_uses,
      valid_from: CouponTable.valid_from,
      valid_until: CouponTable.valid_until,
    })
    .from(CouponTable)
    .where(and(...couponScope, ...periodScope))
    .orderBy(CouponTable.attribution_user_id, desc(CouponTable.createdAt))
    .as("current_coupon");

  return { usageSq, rewardSq, discountSq, currentCouponSq };
}

type StatsSources = ReturnType<typeof buildStatsSources>;

/** 主表（grants）+ 発行者 + 集計サブクエリを結合した動的クエリ（where / orderBy / limit を後付けする） */
function selectWithStats(sources: StatsSources) {
  const { usageSq, rewardSq, discountSq, currentCouponSq } = sources;
  const g = CouponIssuerGrantTable;
  return db
    .select({
      grant: g,
      userId: UserTable.id,
      userName: UserTable.name,
      userEmail: UserTable.email,
      lifetimeUses: sql<number>`COALESCE(${usageSq.lifetimeUses}, 0)`,
      rewardPaidTotal: sql<number>`COALESCE(${rewardSq.rewardPaidTotal}, 0)`,
      rewardPaidCurrentPeriod: sql<number>`COALESCE(${rewardSq.rewardPaidCurrentPeriod}, 0)`,
      discountTotal: sql<number>`COALESCE(${discountSq.discountTotal}, 0)`,
      currentPeriodUses: sql<number>`COALESCE(${currentCouponSq.current_total_uses}, 0)`,
      couponId: currentCouponSq.id,
      couponCode: currentCouponSq.code,
      couponStatus: currentCouponSq.status,
      couponMaxTotalUses: currentCouponSq.max_total_uses,
      couponValidFrom: currentCouponSq.valid_from,
      couponValidUntil: currentCouponSq.valid_until,
    })
    .from(g)
    .leftJoin(UserTable, eq(g.user_id, UserTable.id))
    .leftJoin(usageSq, eq(g.user_id, usageSq.user_id))
    .leftJoin(rewardSq, eq(g.user_id, rewardSq.user_id))
    .leftJoin(discountSq, eq(g.user_id, discountSq.user_id))
    .leftJoin(currentCouponSq, eq(g.user_id, currentCouponSq.user_id))
    .$dynamic();
}

function toGrantWithStats(row: Record<string, unknown>): GrantWithStats {
  const couponId = row.couponId as string | null;
  return {
    grant: row.grant as CouponIssuerGrant,
    user: row.userId
      ? {
          id: row.userId as string,
          name: (row.userName as string | null) ?? null,
          email: (row.userEmail as string | null) ?? null,
        }
      : null,
    currentPeriodCoupon: couponId
      ? {
          id: couponId,
          code: row.couponCode as string,
          status: row.couponStatus as "active" | "inactive",
          current_total_uses: Number(row.currentPeriodUses ?? 0),
          max_total_uses: row.couponMaxTotalUses == null ? null : Number(row.couponMaxTotalUses),
          valid_from: (row.couponValidFrom as Date | null) ?? null,
          valid_until: (row.couponValidUntil as Date | null) ?? null,
        }
      : null,
    currentPeriodUses: Number(row.currentPeriodUses ?? 0),
    lifetimeUses: Number(row.lifetimeUses ?? 0),
    rewardPaidCurrentPeriod: Number(row.rewardPaidCurrentPeriod ?? 0),
    rewardPaidTotal: Number(row.rewardPaidTotal ?? 0),
    discountTotal: Number(row.discountTotal ?? 0),
  };
}

// ============================================================================
// 一覧
// ============================================================================

export async function getGrantListWithStats(
  params: GetGrantListWithStatsParams = {},
): Promise<GetGrantListWithStatsResult> {
  const { page = 1, limit = 20, searchQuery, sort } = params;
  const offset = (page - 1) * limit;
  const g = CouponIssuerGrantTable;

  const { period, couponScope } = resolveProgramScope();
  const sources = buildStatsSources(period, couponScope);
  const { usageSq, rewardSq, discountSq, currentCouponSq } = sources;

  // 絞り込み
  const conditions: SQL[] = [];
  if (params.status) {
    const statuses = Array.isArray(params.status) ? params.status : [params.status];
    if (statuses.length === 1) {
      conditions.push(eq(g.status, statuses[0]));
    } else if (statuses.length > 1) {
      conditions.push(sql`${g.status} IN (${sql.join(statuses.map((s) => sql`${s}`), sql`, `)})`);
    }
  }
  if (searchQuery) {
    const pattern = `%${searchQuery}%`;
    conditions.push(or(ilike(UserTable.name, pattern), ilike(UserTable.email, pattern)) as SQL);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 件数（検索条件が users を参照するため JOIN 込みで数える）
  const [{ value: total }] = await db
    .select({ value: drizzleCount() })
    .from(g)
    .leftJoin(UserTable, eq(g.user_id, UserTable.id))
    .where(whereClause);

  // ソート
  const sortExprs: Record<string, SQL> = {
    requested_at: sql`${g.requested_at}`,
    lifetimeUses: sql`COALESCE(${usageSq.lifetimeUses}, 0)`,
    rewardPaidTotal: sql`COALESCE(${rewardSq.rewardPaidTotal}, 0)`,
    rewardPaidCurrentPeriod: sql`COALESCE(${rewardSq.rewardPaidCurrentPeriod}, 0)`,
    discountTotal: sql`COALESCE(${discountSq.discountTotal}, 0)`,
    currentPeriodUses: sql`COALESCE(${currentCouponSq.current_total_uses}, 0)`,
  };
  const sortExpr = sort ? sortExprs[sort.field] : undefined;
  const orderBy: SQL[] =
    sortExpr && sort
      ? [sort.direction === "asc" ? asc(sortExpr) : desc(sortExpr), desc(g.requested_at)]
      : [desc(g.requested_at)];

  let listQuery = selectWithStats(sources);
  if (whereClause) {
    listQuery = listQuery.where(whereClause);
  }
  const rows = await listQuery.orderBy(...orderBy).limit(limit).offset(offset);

  // グランドトータル（フィルタ非依存）
  const [usageTotal, rewardTotal, discountTotal] = await Promise.all([
    db
      .select({ value: drizzleCount(CouponHistoryTable.id) })
      .from(CouponHistoryTable)
      .innerJoin(CouponTable, eq(CouponHistoryTable.coupon_id, CouponTable.id))
      .where(and(...couponScope)),
    db
      .select({ value: sql<number>`COALESCE(SUM(${CouponAttributionRewardTable.amount}), 0)` })
      .from(CouponAttributionRewardTable)
      .where(eq(CouponAttributionRewardTable.status, "fulfilled")),
    db
      .select({ value: sql<number>`COALESCE(SUM(${PurchaseRequestTable.discount_amount}), 0)` })
      .from(PurchaseRequestTable)
      .innerJoin(CouponTable, eq(PurchaseRequestTable.coupon_code, CouponTable.code))
      .where(and(eq(PurchaseRequestTable.status, "completed"), ...couponScope)),
  ]);

  return {
    items: (rows as Array<Record<string, unknown>>).map(toGrantWithStats),
    total,
    grandTotals: {
      lifetimeUses: Number(usageTotal[0]?.value ?? 0),
      rewardPaidTotal: Number(rewardTotal[0]?.value ?? 0),
      discountTotal: Number(discountTotal[0]?.value ?? 0),
    },
    period,
  };
}

// ============================================================================
// 単体（詳細画面ヘッダ用）
// ============================================================================

/** grant 1 件分の統計（一覧 1 行と同じ形）。grant が無ければ null */
export async function getIssuerStatsByGrantId(grantId: string): Promise<GrantWithStats | null> {
  const { couponScope, period } = resolveProgramScope();
  const sources = buildStatsSources(period, couponScope);
  const rows = await selectWithStats(sources)
    .where(eq(CouponIssuerGrantTable.id, grantId))
    .limit(1);
  const row = (rows as Array<Record<string, unknown>>)[0];
  return row ? toGrantWithStats(row) : null;
}

// ============================================================================
// ドリルダウン: 利用履歴
// ============================================================================

export type IssuerUsageHistoryItem = {
  id: string;
  coupon: { id: string; code: string; name: string };
  redeemer: { id: string; name: string | null } | null;
  metadata: Record<string, unknown>;
  createdAt: Date | null;
};

/** 発行者の affiliate クーポン群にまたがる利用履歴（新しい順、ページング必須） */
export async function getIssuerUsageHistory(params: {
  userId: string;
  page?: number;
  limit?: number;
}): Promise<{ items: IssuerUsageHistoryItem[]; total: number }> {
  const { userId, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;
  const { couponScope } = resolveProgramScope();
  const h = CouponHistoryTable;

  const whereClause = and(eq(CouponTable.attribution_user_id, userId), ...couponScope);

  const [{ value: total }] = await db
    .select({ value: drizzleCount() })
    .from(h)
    .innerJoin(CouponTable, eq(h.coupon_id, CouponTable.id))
    .where(whereClause);

  const rows = await db
    .select({
      id: h.id,
      couponId: CouponTable.id,
      couponCode: CouponTable.code,
      couponName: CouponTable.name,
      redeemerId: UserTable.id,
      redeemerName: UserTable.name,
      metadata: h.metadata,
      createdAt: h.createdAt,
    })
    .from(h)
    .innerJoin(CouponTable, eq(h.coupon_id, CouponTable.id))
    .leftJoin(UserTable, eq(h.redeemer_user_id, UserTable.id))
    .where(whereClause)
    .orderBy(desc(h.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map((row) => ({
      id: row.id,
      coupon: { id: row.couponId, code: row.couponCode, name: row.couponName },
      redeemer: row.redeemerId ? { id: row.redeemerId, name: row.redeemerName ?? null } : null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.createdAt,
    })),
    total,
  };
}

// ============================================================================
// ドリルダウン: 報酬履歴
// ============================================================================

export type IssuerRewardHistoryItem = CouponAttributionReward & {
  coupon: { id: string; code: string } | null;
};

/** 発行者が受取人の帰属報酬履歴（全 status、新しい順、ページング必須） */
export async function getIssuerRewardHistory(params: {
  userId: string;
  page?: number;
  limit?: number;
}): Promise<{ items: IssuerRewardHistoryItem[]; total: number }> {
  const { userId, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;
  const r = CouponAttributionRewardTable;

  const [{ value: total }] = await db
    .select({ value: drizzleCount() })
    .from(r)
    .where(eq(r.recipient_user_id, userId));

  const rows = await db
    .select({
      reward: r,
      couponId: CouponTable.id,
      couponCode: CouponTable.code,
    })
    .from(r)
    .leftJoin(CouponTable, eq(r.coupon_id, CouponTable.id))
    .where(eq(r.recipient_user_id, userId))
    .orderBy(desc(r.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map((row) => ({
      ...(row.reward as CouponAttributionReward),
      coupon: row.couponId ? { id: row.couponId, code: row.couponCode as string } : null,
    })),
    total,
  };
}

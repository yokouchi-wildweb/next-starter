// 招待コード発行者一覧 + 紹介人数を集計して返す（管理画面用）

import { db } from "@/lib/drizzle";
import { CouponTable } from "@/features/core/coupon/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { ReferralTable } from "../../../entities/drizzle";
import type { Coupon } from "@/features/core/coupon/entities/model";
import { and, eq, isNull, sql, desc, ilike, or, count as drizzleCount, inArray } from "drizzle-orm";

export type InviteCodeWithCount = {
  coupon: Coupon;
  referralCount: number;
  issuerName: string | null;
};

export type GetInviteCodeListParams = {
  page?: number;
  limit?: number;
  searchQuery?: string;
};

export type GetInviteCodeListResult = {
  items: InviteCodeWithCount[];
  total: number;
};

/**
 * 招待コード（type='invite'）の一覧を取得し、各発行者の紹介人数を集計して返す
 */
export async function getInviteCodeListWithCounts(
  params: GetInviteCodeListParams = {},
): Promise<GetInviteCodeListResult> {
  const { page = 1, limit = 20, searchQuery } = params;
  const offset = (page - 1) * limit;

  // invite型クーポンの検索条件
  const baseConditions = [
    eq(CouponTable.type, "invite"),
    isNull(CouponTable.deletedAt),
  ];

  // テキスト検索
  if (searchQuery) {
    const pattern = `%${searchQuery}%`;
    baseConditions.push(
      or(
        ilike(CouponTable.code, pattern),
        ilike(CouponTable.attribution_user_id, pattern),
      )!,
    );
  }

  const whereClause = and(...baseConditions);

  // 件数取得
  const [{ value: total }] = await db
    .select({ value: drizzleCount() })
    .from(CouponTable)
    .where(whereClause);

  // クーポン一覧取得
  const coupons = await db
    .select()
    .from(CouponTable)
    .where(whereClause)
    .orderBy(desc(CouponTable.createdAt))
    .limit(limit)
    .offset(offset) as Coupon[];

  if (coupons.length === 0) {
    return { items: [], total };
  }

  // 各発行者の紹介人数を一括集計
  const userIds = coupons
    .map((c) => c.attribution_user_id)
    .filter((id): id is string => id !== null);

  let countMap = new Map<string, number>();

  if (userIds.length > 0) {
    const counts = await db
      .select({
        inviter_user_id: ReferralTable.inviter_user_id,
        count: drizzleCount(),
      })
      .from(ReferralTable)
      .where(
        and(
          sql`${ReferralTable.inviter_user_id} IN (${sql.join(
            userIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
          eq(ReferralTable.status, "active"),
        ),
      )
      .groupBy(ReferralTable.inviter_user_id);

    countMap = new Map(counts.map((r) => [r.inviter_user_id, r.count]));
  }

  // 発行者のユーザー名を一括取得
  let nameMap = new Map<string, string | null>();

  if (userIds.length > 0) {
    const users = await db
      .select({
        id: UserTable.id,
        name: UserTable.name,
      })
      .from(UserTable)
      .where(inArray(UserTable.id, userIds));

    nameMap = new Map(users.map((u) => [u.id, u.name]));
  }

  const items: InviteCodeWithCount[] = coupons.map((coupon) => ({
    coupon,
    referralCount: countMap.get(coupon.attribution_user_id ?? "") ?? 0,
    issuerName: nameMap.get(coupon.attribution_user_id ?? "") ?? null,
  }));

  return { items, total };
}

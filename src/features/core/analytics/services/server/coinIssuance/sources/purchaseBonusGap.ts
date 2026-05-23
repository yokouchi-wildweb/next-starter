// src/features/core/analytics/services/server/coinIssuance/sources/purchaseBonusGap.ts
// coinIssuance ソース: コイン購入時にサービス側が負担した「上乗せボーナス全般」。
//
// 集計対象:
//   purchase_requests のうち status='completed' のレコードに対し、
//   `amount - payment_amount` の合計を発行コイン量として扱う。
//
// 意味:
//   - amount         = 実際にユーザーへ付与したコイン数
//   - payment_amount = 実際にユーザーから受け取った JPY 額
//   - 1 JPY = 1 coin 基準の購入パッケージを前提とすると、
//     amount - payment_amount は「クーポン割引 / ユーザーランクボーナス /
//     決済方法ボーナス / 購入パッケージの上乗せボーナス等で
//     上乗せされた、サービス側がコストとして負担した分」に相当する。
//
//   ※ 旧名称 `coupon_bonus_gap` は実態より狭い印象を与えていたため
//      `purchase_bonus_gap` にリネームした (README の Breaking Changes 参照)。
//      購入と無関係なコインボーナス (紹介リワード・当選報告特典等) は
//      別ソースとして登録されるため、本ソースには含まれない。
//
// 期間判定:
//   completed_at で行う (既存 purchaseAnalytics と同じ)。
//
// UserFilter:
//   purchase_requests.user_id に対して buildUserFilterConditions で適用する。

import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { and, between, eq, sql } from "drizzle-orm";

import { buildUserFilterConditions } from "../../utils/userFilter";
import type { CoinIssuanceSource } from "../types";

const p = PurchaseRequestTable;

export const purchaseBonusGapSource: CoinIssuanceSource = {
  key: "purchase_bonus_gap",
  kind: "issuance",

  async aggregate({ range, prevRange, userFilter }) {
    const isCurrent = sql`(${p.completed_at} >= ${range.dateFrom.toISOString()} AND ${p.completed_at} <= ${range.dateTo.toISOString()})`;
    const isPrev = sql`(${p.completed_at} >= ${prevRange.dateFrom.toISOString()} AND ${p.completed_at} <= ${prevRange.dateTo.toISOString()})`;

    // 当期+前期を CASE WHEN で 1 クエリ集計
    const rows = await db
      .select({
        current: sql<number>`COALESCE(SUM(CASE WHEN ${isCurrent} THEN (${p.amount} - ${p.payment_amount}) ELSE 0 END), 0)`.as("current_gap"),
        previous: sql<number>`COALESCE(SUM(CASE WHEN ${isPrev} THEN (${p.amount} - ${p.payment_amount}) ELSE 0 END), 0)`.as("prev_gap"),
      })
      .from(p)
      .where(and(
        between(p.completed_at, prevRange.dateFrom, range.dateTo),
        eq(p.status, "completed"),
        ...buildUserFilterConditions(p.user_id, userFilter),
      ));

    return {
      current: Number(rows[0]?.current ?? 0),
      previous: Number(rows[0]?.previous ?? 0),
    };
  },
};

// src/features/core/analytics/services/server/coinIssuance/sources/walletBonusGrant.ts
// coinIssuance ソース: 購入以外で仕組みとしてユーザーに配ったコイン(販促・特典の付与)を台帳の純額で数える。
//
// 集計対象:
//   wallet_histories のうち、type が COIN_ISSUANCE_WALLET_TYPES(src/config/app/coin-issuance.config.ts)で、
//   reason_category が countsAsIssuance の区分(src/config/app/wallet-reason-category.config.ts。上流の既定 = bonus)
//   の行の純増減(balance_after - balance_before)の合計。
//   付与元のドメインを問わず 1 本で数えるので、紹介報酬・クーポン帰属報酬・登録ボーナス・fork の施策も
//   wallet の行を bonus で書けばここに入る。施策が増えても合計から黙って抜けない。
//
// 二重計上の注意:
//   付与元の表ごとのソース(紹介報酬 referral_rewards・クーポン帰属報酬 coupon_attribution_rewards など)は
//   このソースの部分集合。合計(sources)に並べると finalProfit が二重に引かれる。内訳を見たい画面は
//   aggregateReferralRewardCurrentVsPrev / aggregateCouponAttributionRewardCurrentVsPrev を別に呼ぶ。
//
// デルタの取り方:
//   points_delta ではなく balance_after - balance_before(SET 行・異常行で points_delta の符号の方式がずれるため)。
//
// 既知の制約(reason_category の導入前の行):
//   導入前に書かれた行は全部 other で埋まっている。上流の既定は other を数えないので混ざらないが、
//   other に印を付けた fork では導入前の期間の値は信用できない(ガチャ・調整・退会の残高クリアが混ざり純額が負になり得る)。
//
// 期間判定: wallet_histories.created_at
// UserFilter・分析の除外: wallet_histories.user_id に buildUserFilterConditions(flow の scope、source wallet_histories)

import { and, between, inArray, sql } from "drizzle-orm";

import { COIN_ISSUANCE_WALLET_TYPES } from "@/config/app/coin-issuance.config";
import { gate } from "@/featureGate";
import { db } from "@/lib/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";

import { buildUserFilterConditions } from "../../utils/userFilter";
import { issuanceReasonCategories } from "../issuanceCategories";
import type { CoinIssuanceSource } from "../types";

const t = WalletHistoryTable;

export const source: CoinIssuanceSource = {
  key: "wallet_bonus_grant",
  kind: "issuance",
  // wallet を閉じている間は表が無いことがある
  enabled: () => gate.enabled("wallet"),

  async aggregate({ range, prevRange, userFilter }) {
    const categories = issuanceReasonCategories();
    if (categories.length === 0 || COIN_ISSUANCE_WALLET_TYPES.length === 0) {
      return { current: 0, previous: 0 };
    }

    const delta = sql`(${t.balance_after} - ${t.balance_before})`;
    const isCurrent = sql`(${t.createdAt} >= ${range.dateFrom.toISOString()} AND ${t.createdAt} <= ${range.dateTo.toISOString()})`;
    const isPrev = sql`(${t.createdAt} >= ${prevRange.dateFrom.toISOString()} AND ${t.createdAt} <= ${prevRange.dateTo.toISOString()})`;

    // 当期+前期を CASE WHEN で 1 クエリ集計
    const rows = await db
      .select({
        current: sql<number>`COALESCE(SUM(CASE WHEN ${isCurrent} THEN ${delta} ELSE 0 END), 0)`.as("current_grant"),
        previous: sql<number>`COALESCE(SUM(CASE WHEN ${isPrev} THEN ${delta} ELSE 0 END), 0)`.as("prev_grant"),
      })
      .from(t)
      .where(and(
        between(t.createdAt, prevRange.dateFrom, range.dateTo),
        inArray(t.type, [...COIN_ISSUANCE_WALLET_TYPES]),
        inArray(t.reason_category, categories),
        ...buildUserFilterConditions(t.user_id, userFilter, { kind: "flow", source: "wallet_histories", rowId: t.id }),
      ));

    return {
      current: Number(rows[0]?.current ?? 0),
      previous: Number(rows[0]?.previous ?? 0),
    };
  },
};

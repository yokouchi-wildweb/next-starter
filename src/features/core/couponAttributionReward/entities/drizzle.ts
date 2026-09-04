// src/features/core/couponAttributionReward/entities/drizzle.ts

import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { WalletTypeEnum } from "@/features/core/wallet/entities/drizzle";
import { COUPON_ATTRIBUTION_REWARD_STATUSES } from "@/features/core/couponAttributionReward/constants";

export const CouponAttributionRewardStatusEnum = pgEnum(
  "coupon_attribution_reward_status",
  COUPON_ATTRIBUTION_REWARD_STATUSES,
);

/**
 * coupon_attribution_rewards
 *
 * 帰属ユーザー付きクーポン（invite / affiliate）が消込された際に、発行者へ付与した
 * ウォレット報酬の台帳。1 消込（coupon_histories 1 行）につき最大 1 行（冪等キー）。
 *
 * FK は張らない（couponHistory / referralReward と同じ方針: 集計用の永続台帳であり、
 * 参照先のハード削除で報酬記録が消えるべきではない）。
 */
export const CouponAttributionRewardTable = pgTable(
  "coupon_attribution_rewards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** 消込されたクーポン */
    coupon_id: uuid("coupon_id").notNull(),
    /** 冪等キー: この消込に対して報酬は 1 回だけ */
    coupon_history_id: uuid("coupon_history_id").notNull(),
    /** 報酬の受取人（= 消込時点の coupon.attribution_user_id） */
    recipient_user_id: uuid("recipient_user_id").notNull(),
    /** 消込したユーザー（参考。ゲスト消込は null） */
    redeemer_user_id: uuid("redeemer_user_id"),
    wallet_type: WalletTypeEnum("wallet_type").notNull(),
    /** 付与額（通貨最小単位の整数） */
    amount: integer("amount").notNull(),
    status: CouponAttributionRewardStatusEnum("status").notNull().default("pending"),
    /** 付与時の wallet_histories.id（fulfilled で確定） */
    wallet_history_id: uuid("wallet_history_id"),
    fulfilled_at: timestamp("fulfilled_at", { withTimezone: true }),
    /** failed 時の理由（例外メッセージ。運用者向け） */
    failure_reason: text("failure_reason"),
    /** 呼び出し側の任意情報（rate / purchaseAmount / purchaseRequestId 等） */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("coupon_attr_rewards_history_uniq").on(table.coupon_history_id),
    index("coupon_attr_rewards_recipient_created_idx").on(table.recipient_user_id, table.createdAt),
    index("coupon_attr_rewards_status_fulfilled_idx").on(table.status, table.fulfilled_at),
    index("coupon_attr_rewards_coupon_idx").on(table.coupon_id),
  ],
);

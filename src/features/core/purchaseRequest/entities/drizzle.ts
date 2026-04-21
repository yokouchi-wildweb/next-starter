// src/features/purchaseRequest/entities/drizzle.ts

import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import { PURCHASE_TYPE_KEYS, type PurchaseTypeKey } from "@/config/app/purchaseType.config";

// CURRENCY_CONFIG から動的に walletType の値を取得
const walletTypes = Object.keys(CURRENCY_CONFIG) as [WalletType, ...WalletType[]];
// PURCHASE_TYPE_CONFIG から動的に purchaseType の値を取得
const purchaseTypes = PURCHASE_TYPE_KEYS as [PurchaseTypeKey, ...PurchaseTypeKey[]];

export const PurchaseRequestWalletTypeEnum = pgEnum("purchaseRequest_wallet_type_enum", walletTypes);
export const PurchaseRequestPurchaseTypeEnum = pgEnum("purchaseRequest_purchase_type_enum", purchaseTypes);
export const PurchaseRequestStatusEnum = pgEnum("purchaseRequest_status_enum", ["pending", "processing", "completed", "failed", "expired"]);

export const PurchaseRequestTable = pgTable("purchase_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull()
    .references(() => UserTable.id, { onDelete: "cascade" }),
  wallet_history_id: uuid("wallet_history_id")
    .references(() => WalletHistoryTable.id, { onDelete: "cascade" }),
  idempotency_key: uuid("idempotency_key").notNull().unique(),
  // 購入の履行形態を識別するディスクリミネータ。
  // wallet_type とセットで「どの戦略で完了処理を行うか」が決まる（completion/strategyRegistry 参照）。
  // 既存レコードは default 'wallet_topup' で埋まる。
  purchase_type: PurchaseRequestPurchaseTypeEnum("purchase_type").notNull().default("wallet_topup"),
  // 加算対象のウォレット種別。purchase_type=wallet_topup のときのみ必須。
  // direct_sale 等のウォレット加算を伴わない購入タイプでは NULL を許容する。
  wallet_type: PurchaseRequestWalletTypeEnum("wallet_type"),
  amount: integer("amount").notNull(),
  payment_amount: integer("payment_amount").notNull(),
  payment_method: text("payment_method").notNull(),
  status: PurchaseRequestStatusEnum("status").notNull(),
  payment_provider: text("payment_provider").notNull(),
  payment_session_id: text("payment_session_id"),
  provider_order_id: text("provider_order_id"),
  transaction_id: text("transaction_id"),
  redirect_url: text("redirect_url"),
  error_code: text("error_code"),
  error_message: text("error_message"),
  webhook_signature: text("webhook_signature"),
  coupon_code: text("coupon_code"),
  discount_amount: integer("discount_amount"),
  original_payment_amount: integer("original_payment_amount"),
  coupon_redeem_failed: boolean("coupon_redeem_failed").default(false),
  milestone_results: jsonb("milestone_results"),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  paid_at: timestamp("paid_at", { withTimezone: true }),
  expires_at: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("purchase_requests_payment_session_id_idx").on(table.payment_session_id),
  index("purchase_requests_provider_order_id_idx").on(table.provider_order_id),
  index("purchase_requests_status_idx").on(table.status),
  index("purchase_requests_user_id_status_idx").on(table.user_id, table.status),
  // Analytics用: 売上集計の日付範囲フィルタ
  index("purchase_requests_status_completed_at_idx").on(table.status, table.completed_at),
  index("purchase_requests_user_completed_at_idx").on(table.user_id, table.completed_at),
  index("purchase_requests_wallet_type_completed_at_idx").on(table.wallet_type, table.completed_at),
  index("purchase_requests_purchase_type_completed_at_idx").on(table.purchase_type, table.completed_at),
  index("purchase_requests_provider_completed_at_idx").on(table.payment_provider, table.completed_at),
  // バッチ処理用: expirePendingRequests の WHERE status='pending' AND expires_at < now
  index("purchase_requests_status_expires_at_idx").on(table.status, table.expires_at),
]);

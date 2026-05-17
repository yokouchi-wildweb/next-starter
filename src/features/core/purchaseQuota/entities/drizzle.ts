// src/features/core/purchaseQuota/entities/drizzle.ts

import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * 購入クォータ台帳テーブル。
 *
 * 1 行 = 1 件の購入リクエストに対する金額予約レコード。
 * status が "released" 以外の行を期間内で SUM することでウィンドウ別の使用量を算出する。
 *
 * - id: ULID/UUIDv7 風の文字列主キー
 * - user_id: ユーザー単位の集計キー (FK なし。User 削除後も台帳整合性を維持)
 * - payment_method: 決済方法名 (PurchaseRequestPaymentMethodOptions の value と一致)
 * - amount: 円単位の整数 (payment_amount と同一通貨・スケール)
 * - purchase_request_id: 紐付け対象 purchase_request の id (FK なし)
 * - status: "reserved" | "committed" | "released"
 *
 * 集計除外: status = "released"
 */
export const PurchaseQuotaLedgerTable = pgTable(
  "purchase_quota_ledger",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id").notNull(),
    payment_method: text("payment_method").notNull(),
    amount: integer("amount").notNull(),
    purchase_request_id: text("purchase_request_id").notNull(),
    status: text("status").notNull(),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    user_created_idx: index("purchase_quota_ledger_user_created_idx").on(
      t.user_id,
      t.created_at,
    ),
    purchase_request_idx: index("purchase_quota_ledger_pr_idx").on(
      t.purchase_request_id,
    ),
  }),
);

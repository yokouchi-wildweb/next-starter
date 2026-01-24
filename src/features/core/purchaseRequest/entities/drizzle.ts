// src/features/purchaseRequest/entities/drizzle.ts

import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";

// CURRENCY_CONFIG から動的に walletType の値を取得
const walletTypes = Object.keys(CURRENCY_CONFIG) as [WalletType, ...WalletType[]];

export const PurchaseRequestWalletTypeEnum = pgEnum("purchaseRequest_wallet_type_enum", walletTypes);
export const PurchaseRequestStatusEnum = pgEnum("purchaseRequest_status_enum", ["pending", "processing", "completed", "failed", "expired"]);

export const PurchaseRequestTable = pgTable("purchase_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull()
    .references(() => UserTable.id, { onDelete: "cascade" }),
  wallet_history_id: uuid("wallet_history_id")
    .references(() => WalletHistoryTable.id, { onDelete: "cascade" }),
  idempotency_key: uuid("idempotency_key").notNull().unique(),
  wallet_type: PurchaseRequestWalletTypeEnum("wallet_type").notNull(),
  amount: integer("amount").notNull(),
  payment_amount: integer("payment_amount").notNull(),
  payment_method: text("payment_method").notNull(),
  status: PurchaseRequestStatusEnum("status").notNull(),
  payment_provider: text("payment_provider").notNull(),
  payment_session_id: text("payment_session_id"),
  transaction_id: text("transaction_id"),
  redirect_url: text("redirect_url"),
  error_code: text("error_code"),
  error_message: text("error_message"),
  webhook_signature: text("webhook_signature"),
  completed_at: timestamp("completed_at"),
  paid_at: timestamp("paid_at", { withTimezone: true }),
  expires_at: timestamp("expires_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

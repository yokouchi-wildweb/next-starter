// src/features/walletHistory/entities/drizzle.ts

import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { WalletTypeEnum } from "@/features/core/wallet/entities/drizzle";
import type { WalletHistoryMeta } from "@/features/core/walletHistory/types/meta";
import { DEFAULT_REASON_CATEGORY, type ReasonCategory } from "@/config/app/reason-category.config";

export const WalletHistoryChangeMethodEnum = pgEnum("wallet_change_method", ["INCREMENT", "DECREMENT", "SET"]);
export const WalletHistorySourceTypeEnum = pgEnum("wallet_history_source_type", ["user_action", "admin_action", "system"]);

export const WalletHistoryTable = pgTable(
  "wallet_histories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 外部キー制約なし: ユーザー削除後も履歴を監査用に保持するため
    user_id: uuid("user_id").notNull(),
    type: WalletTypeEnum("type").notNull(),
    change_method: WalletHistoryChangeMethodEnum("change_method").notNull(),
    points_delta: integer("points_delta").notNull(),
    balance_before: integer("balance_before").notNull(),
    balance_after: integer("balance_after").notNull(),
    source_type: WalletHistorySourceTypeEnum("source_type").notNull(),
    request_batch_id: uuid("request_batch_id"),
    reason: text("reason"),
    reason_category: text("reason_category").$type<ReasonCategory>().notNull().default(DEFAULT_REASON_CATEGORY),
    meta: jsonb("meta").$type<WalletHistoryMeta>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("wallet_histories_user_id_idx").on(table.user_id),
    userIdCreatedAtIdx: index("wallet_histories_user_id_created_at_idx").on(table.user_id, table.createdAt),
    userTypeCreatedAtIdx: index("wallet_histories_user_type_created_idx").on(table.user_id, table.type, table.createdAt),
    reasonCategoryIdx: index("wallet_histories_reason_category_idx").on(table.reason_category),
    reasonCategoryCreatedAtIdx: index("wallet_histories_reason_category_created_at_idx").on(table.reason_category, table.createdAt),
  }),
);

// src/domains/core/wallet/entities/wallet/drizzle.ts

import { UserTable } from "@/domains/core/user/entities/drizzle";
import { walletConfig } from "@/domains/wallet/config";
import type { WalletType } from "@/domains/wallet/config";
import { index, integer, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// walletConfig.currency から動的に walletType の値を取得
export const walletTypes = Object.keys(walletConfig.currency) as [WalletType, ...WalletType[]];
export const WalletTypeEnum = pgEnum("wallet_type_enum", walletTypes);
export const WalletTable = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    type: WalletTypeEnum("type").notNull(),
    balance: integer("balance").notNull().default(0),
    locked_balance: integer("locked_balance").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userTypeUnique: uniqueIndex("wallets_user_type_idx").on(table.user_id, table.type),
    // Analytics用（state軸）: WHERE type=X ORDER BY balance DESC のランキング/サマリー/分布
    typeBalanceIdx: index("wallets_type_balance_idx").on(table.type, table.balance.desc()),
    // Analytics用（state軸）: sortBy=lockedBalance のランキング
    typeLockedBalanceIdx: index("wallets_type_locked_balance_idx").on(table.type, table.locked_balance.desc()),
    // 差分リフレッシュ（createIncrementalRefresh）の走査と、絞り込みなしの更新日順の検索
    updatedAtIdx: index("wallets_updated_at_idx").on(table.updatedAt),
  }),
);

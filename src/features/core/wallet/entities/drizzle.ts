// src/features/wallet/entities/drizzle.ts

import { integer, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { UserTable } from "@/features/core/user/entities/drizzle";
// [!!] 通貨種別の追加・削除時は currency.config.ts と合わせて更新すること
// currency.config.ts を直接 import すると、icon の .tsx 依存が drizzle-kit の esbuild でエラーになるためリテラル定義
// TODO: currency.config.ts のキーとの同期を型レベルで保証する仕組みを検討
export const WalletTypeEnum = pgEnum("wallet_type_enum", ["regular_coin", "regular_point"]);

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
  }),
);

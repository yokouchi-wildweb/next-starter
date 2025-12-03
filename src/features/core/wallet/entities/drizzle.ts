// src/features/wallet/entities/drizzle.ts

import { integer, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { UserTable } from "@/features/core/user/entities/drizzle";

export const WalletTypeEnum = pgEnum("wallet_type_enum", ["regular_point", "temporary_point"]);

export const WalletTable = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => UserTable.id),
    type: WalletTypeEnum("type").notNull(),
    balance: integer("balance").notNull().default(0),
    locked_balance: integer("locked_balance").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userTypeUnique: uniqueIndex("wallets_user_type_idx").on(table.user_id, table.type),
  }),
);

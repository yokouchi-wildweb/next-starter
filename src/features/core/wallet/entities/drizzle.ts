// src/features/wallet/entities/drizzle.ts

import { index, integer, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";

// CURRENCY_CONFIG から動的に walletType の値を取得
const walletTypes = Object.keys(CURRENCY_CONFIG) as [WalletType, ...WalletType[]];

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
  }),
);

/**
 * ウォレットロット（付与単位の台帳）
 *
 * 有効期限が有効な walletType でのみ行が作られる（無効な通貨は一切書き込まれない）。
 * 不変条件: SUM(remaining) = wallets.balance（有効化+初期化済みのウォレットに限る）。
 * 全てのロット操作は wallets 行ロックと同一トランザクション内で行うこと。
 * 設定: src/config/app/wallet-expiration.config.ts
 */
export const WalletLotTable = pgTable(
  "wallet_lots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    wallet_id: uuid("wallet_id")
      .notNull()
      .references(() => WalletTable.id, { onDelete: "cascade" }),
    // 付与時の額（監査・表示用に保持）
    granted_amount: integer("granted_amount").notNull(),
    // 未消費残（FIFO消費・失効で減算。0 = 消費/失効済み）
    remaining: integer("remaining").notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    // FIFO消費・失効間近照会用（remaining>0 の行のみが対象になるため部分インデックス）
    walletExpiresIdx: index("wallet_lots_wallet_expires_idx")
      .on(table.wallet_id, table.expires_at)
      .where(sql`${table.remaining} > 0`),
    // 失効スイープ用: WHERE expires_at < NOW() AND remaining > 0
    expiresIdx: index("wallet_lots_expires_idx")
      .on(table.expires_at)
      .where(sql`${table.remaining} > 0`),
  }),
);

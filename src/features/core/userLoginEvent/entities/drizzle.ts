// src/features/core/userLoginEvent/entities/drizzle.ts

import { index, inet, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { USER_LOGIN_EVENT_TYPES } from "@/features/core/userLoginEvent/constants";
import { UserTable } from "@/features/core/user/entities/drizzle";

export const UserLoginEventTypeEnum = pgEnum("user_login_event_type", [...USER_LOGIN_EVENT_TYPES]);

/**
 * ユーザーのログイン / サインアップ成功イベントを正規化して保持するテーブル。
 *
 * 用途は IP 単位 / サブネット単位でのクロスユーザー集計
 * (同一 IP で運用されているアカウント数 / 同一 /24 配下のアカウント一覧 等)。
 *
 * 設計ポイント:
 * - ip カラムは PostgreSQL `inet` 型。`=` での btree 検索に加え、
 *   `<<=` (サブネット包含) によるサブネット集計が直接インデックスで走る。
 * - 行単位 `retention_days` 列を持ち、日次 cron でプルーニングする
 *   (audit_logs と同じ運用パターン)。
 * - 失敗イベントは含めない。失敗系は audit_logs (auth.login.failed) が真。
 */
export const UserLoginEventTable = pgTable(
  "user_login_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    eventType: UserLoginEventTypeEnum("event_type").notNull(),
    ip: inet("ip").notNull(),
    userAgent: text("user_agent"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    retentionDays: integer("retention_days").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // ユーザー別のログイン履歴タイムライン
    userIdx: index("user_login_events_user_idx").on(table.userId, table.occurredAt),
    // 主用途: IP 重複検索 (同一 IP のアカウント横断検出)
    ipIdx: index("user_login_events_ip_idx").on(table.ip, table.occurredAt),
    // event_type 別の集計 (signup のみ / login のみ等)
    eventTypeIdx: index("user_login_events_event_type_idx").on(table.eventType, table.occurredAt),
    // retention pruning 用 (created_at + retention_days * INTERVAL で算出)
    createdAtIdx: index("user_login_events_created_at_idx").on(table.createdAt),
  }),
);

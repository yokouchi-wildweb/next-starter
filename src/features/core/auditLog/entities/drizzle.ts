// src/features/core/auditLog/entities/drizzle.ts

import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { AUDIT_ACTOR_TYPES } from "@/features/core/auditLog/constants";

export const AuditActorTypeEnum = pgEnum("audit_actor_type", [...AUDIT_ACTOR_TYPES]);

/**
 * 汎用監査ログ。
 *
 * 全ドメイン横断で利用される append-only テーブル。
 * - target_type / target_id: 監査対象の domain と record（target_id は uuid 以外も許容するため text）
 * - action: "<domain>.<entity>.<verb>" 規約（例: "user.email.changed"）
 * - before / after: 変更されたフィールドのみ（trackedFields でフィルタ済みの想定）
 * - context: actor 以外の付随情報（ip, user_agent, session_id, request_id）
 * - retention_days: 行単位の保持期間。日次プルーニングで参照される
 *
 * パーティショニング（PARTITION BY RANGE created_at）は将来導入予定。
 * 現状は単一テーブル + retention_days による DELETE で運用する。
 */
export const AuditLogTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    actorId: text("actor_id"),
    actorType: AuditActorTypeEnum("actor_type").notNull(),
    action: text("action").notNull(),
    beforeValue: jsonb("before_value"),
    afterValue: jsonb("after_value"),
    context: jsonb("context"),
    metadata: jsonb("metadata"),
    reason: text("reason"),
    retentionDays: integer("retention_days").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // ターゲット別タイムライン用（最頻クエリ）
    targetIdx: index("audit_logs_target_idx").on(table.targetType, table.targetId, table.createdAt),
    // 「このユーザーが行った操作一覧」
    actorIdx: index("audit_logs_actor_idx").on(table.actorId, table.createdAt),
    // action prefix での検索（"user.*.changed" 等）。完全一致 / LIKE 検索の出発点
    actionIdx: index("audit_logs_action_idx").on(table.action, table.createdAt),
    // retention pruning 用（created_at + retention_days * INTERVAL で算出）
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  }),
);

/**
 * audit_logs 書き込みに失敗したレコードの退避先（dead-letter）。
 *
 * - bestEffort: true で記録された場合、insert 失敗時にここへ退避される
 * - parent tx の rollback と独立したトランザクションで書く（呼び出し側 tx 失敗の影響を受けない）
 * - 復旧スクリプトで定期的に再 insert を試みる運用を想定
 */
export const AuditLogFailedTable = pgTable(
  "audit_logs_failed",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payload: jsonb("payload").notNull(),
    errorMessage: text("error_message"),
    errorStack: text("error_stack"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("audit_logs_failed_created_at_idx").on(table.createdAt),
  }),
);

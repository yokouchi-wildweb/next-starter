// src/features/core/userProfile/entities/debugerProfile.ts
// デバッガー（debuger）ロール用のプロフィールテーブル
//
// 元情報: src/features/core/userProfile/profiles/debuger.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import { UserTable } from "@/features/core/user/entities/drizzle";
import { uuid, timestamp, text, boolean, pgTable } from "drizzle-orm/pg-core";

/**
 * デバッガープロフィールテーブル
 *
 * @source debuger.profile.json
 */
export const DebugerProfileTable = pgTable("debuger_profiles", {
  // ==========================================================================
  // システムフィールド（全プロフィールテーブル共通）
  // ==========================================================================
  /** 主キー */
  id: uuid("id").primaryKey().defaultRandom(),
  /** UserTable.id への外部キー（1:1、unique制約で担保） */
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => UserTable.id, { onDelete: "cascade" }),

  // ==========================================================================
  // プロフィールフィールド
  // @source debuger.profile.json
  // ==========================================================================
  /** name */
  name: text("name"),
  /** 承認日 */
  appovedAt: boolean("appoved_at"),
  /** type */
  type: text("type"),

  // ==========================================================================
  // タイムスタンプ（全プロフィールテーブル共通）
  // ==========================================================================
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * デバッガープロフィールの型
 */
export type DebugerProfile = typeof DebugerProfileTable.$inferSelect;
export type DebugerProfileInsert = typeof DebugerProfileTable.$inferInsert;

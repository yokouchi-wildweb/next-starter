// src/features/core/userProfile/generated/user/drizzle.ts
// 一般（user）ロール用のプロフィールテーブル
//
// 元情報: src/features/core/userProfile/profiles/user.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import { UserTable } from "@/features/core/user/entities/drizzle";
import { uuid, timestamp, text, pgTable } from "drizzle-orm/pg-core";

/**
 * 一般プロフィールテーブル
 *
 * @source user.profile.json
 */
export const UserProfileTable = pgTable("user_profiles", {
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
  // @source user.profile.json
  // ==========================================================================
  /** foo */
  foo: text("foo"),

  // ==========================================================================
  // タイムスタンプ（全プロフィールテーブル共通）
  // ==========================================================================
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * 一般プロフィールの型
 */
export type UserProfile = typeof UserProfileTable.$inferSelect;
export type UserProfileInsert = typeof UserProfileTable.$inferInsert;

// src/features/core/userProfile/generated/admin/drizzle.ts
// 管理者（admin）ロール用のプロフィールテーブル
//
// 元情報: src/features/core/userProfile/profiles/admin.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import { UserTable } from "@/features/core/user/entities/drizzle";
import { uuid, timestamp, text, pgTable } from "drizzle-orm/pg-core";

/**
 * 管理者プロフィールテーブル
 *
 * @source admin.profile.json
 */
export const AdminProfileTable = pgTable("admin_profiles", {
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
  // @source admin.profile.json
  // ==========================================================================
  /** bar */
  bar: text("bar"),
  /** foo */
  foo: text("foo"),

  // ==========================================================================
  // タイムスタンプ（全プロフィールテーブル共通）
  // ==========================================================================
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * 管理者プロフィールの型
 */
export type AdminProfile = typeof AdminProfileTable.$inferSelect;
export type AdminProfileInsert = typeof AdminProfileTable.$inferInsert;

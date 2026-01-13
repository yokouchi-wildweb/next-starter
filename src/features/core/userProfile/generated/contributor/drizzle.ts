// src/features/core/userProfile/generated/contributor/drizzle.ts
// 投稿者（contributor）ロール用のプロフィールテーブル
//
// 元情報: src/features/core/userProfile/profiles/contributor.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import { UserTable } from "@/features/core/user/entities/drizzle";
import { uuid, timestamp, text, boolean, pgTable } from "drizzle-orm/pg-core";

/**
 * 投稿者プロフィールテーブル
 *
 * @source contributor.profile.json
 */
export const ContributorProfileTable = pgTable("contributor_profiles", {
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
  // @source contributor.profile.json
  // ==========================================================================
  /** 組織名 */
  organizationName: text("organization_name"),
  /** 連絡先電話番号 */
  contactPhone: text("contact_phone"),
  /** 自己紹介 */
  bio: text("bio"),
  /** 承認状態 */
  isApproved: boolean("is_approved"),
  /** 承認日時 */
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  /** 承認メモ */
  approvalNote: text("approval_note"),

  // ==========================================================================
  // タイムスタンプ（全プロフィールテーブル共通）
  // ==========================================================================
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * 投稿者プロフィールの型
 */
export type ContributorProfile = typeof ContributorProfileTable.$inferSelect;
export type ContributorProfileInsert = typeof ContributorProfileTable.$inferInsert;

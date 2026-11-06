// src/features/core/user/types/role.ts
// ロール関連の型定義（システム基盤）

import type { ProfileFieldConfig } from "@/features/core/userProfile/types";

/**
 * ロールカテゴリ
 * - admin: システム管理権限を持つロール（管理画面のsystem一覧に表示）
 * - user: 一般利用者ロール（管理画面のgeneral一覧に表示）
 */
export type RoleCategory = "admin" | "user";

/**
 * ロール定義の型（core の coreRoles/ + 追加の roles/ で共通）
 */
export type RoleConfig = {
  readonly id: string;
  readonly label: string;
  readonly category: RoleCategory;
  readonly hasProfile: boolean;
  readonly description?: string;
  readonly profileFields?: readonly ProfileFieldConfig[];
  /** ロールが有効か（未定義は true 扱い） */
  readonly enabled?: boolean;
};

/**
 * fork の上書き（roles/<JSON の名前>.override.ts の export const override）。pnpm generate role が読む
 */
export type RoleOverride = Partial<Pick<RoleConfig, "label" | "hasProfile" | "enabled">>;

/**
 * core ロールの上書き（coreRoles/<JSON の名前>.override.ts）。core ロールは無効にできない
 */
export type CoreRoleOverride = Omit<RoleOverride, "enabled">;


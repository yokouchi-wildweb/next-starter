// src/features/core/user/types/role.ts
// ロール関連の型定義（システム基盤）

import type { ProfileFieldConfig } from "./profileField";

/**
 * ロールカテゴリ
 * - admin: システム管理権限を持つロール（管理画面のsystem一覧に表示）
 * - user: 一般利用者ロール（管理画面のgeneral一覧に表示）
 */
export type RoleCategory = "admin" | "user";

/**
 * ロール定義の型（コア + 追加で共通）
 */
export type RoleConfig<TTag extends string = string> = {
  readonly id: string;
  readonly label: string;
  readonly category: RoleCategory;
  readonly hasProfile: boolean;
  readonly description?: string;
  readonly profileFields?: readonly ProfileFieldConfig<TTag>[];
};

/**
 * 追加ロールの定義型
 */
export type AdditionalRoleConfig<TTag extends string = string> = {
  readonly id: string;
  readonly label: string;
  readonly category: RoleCategory;
  readonly hasProfile: boolean;
  readonly description?: string;
  /**
   * プロフィールフィールド設定（hasProfile: true の場合に定義）
   * 全フィールドを定義（ユーザー編集可能 / 管理者のみ / フラグ 等）
   * - formInput: 入力タイプ（hidden で非表示、switchInput でトグル等）
   * - tags: 用途タグ（registration, mypage, admin, notification 等）
   * @see src/components/Form/DomainFieldRenderer - フォーム描画に使用
   */
  readonly profileFields?: readonly ProfileFieldConfig<TTag>[];
};

/**
 * コアロールID（システム保護）
 */
export type CoreRoleId = "admin" | "user";

/**
 * コアロール拡張設定
 * roles.config.ts でコアロール（admin, user）にプロフィールフィールドを追加する際に使用
 */
export type CoreRoleExtension<TTag extends string = string> = {
  /** プロフィールを有効にするか（デフォルト: false） */
  readonly hasProfile?: boolean;
  /** プロフィールフィールド設定 */
  readonly profileFields?: readonly ProfileFieldConfig<TTag>[];
};

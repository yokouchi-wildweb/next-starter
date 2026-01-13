// src/features/core/user/types/profileField.ts
// プロフィールフィールド関連の型定義（システム基盤）

import type {
  DomainJsonField,
  DomainFieldType,
} from "@/components/Form/DomainFieldRenderer/types";

/**
 * システム必須のコアタグ（変更不可）
 * - admin: 管理画面でのみ表示
 * - registration: 本登録画面で表示
 * - mypage: マイページのプロフィール編集で表示
 */
export const CORE_PROFILE_FIELD_TAGS = ["admin", "registration", "mypage"] as const;
export type CoreProfileFieldTag = (typeof CORE_PROFILE_FIELD_TAGS)[number];

/**
 * プロフィールフィールドの設定（DomainJsonField + profile固有拡張）
 * @see src/components/Form/DomainFieldRenderer/types.ts - DomainJsonField
 */
export type ProfileFieldConfig<TTag extends string = string> = DomainJsonField & {
  /** データ型（Drizzle スキーマ生成に必須） */
  fieldType: DomainFieldType;
  // === profile固有の拡張フィールド ===
  /** 用途タグ（表示箇所のフィルタリングに使用） */
  tags: readonly TTag[];
  /** 説明文（フィールド下に表示） */
  description?: string;
};

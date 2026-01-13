// src/features/core/userProfile/types/field.ts
// プロフィールフィールド関連の型定義

import type {
  DomainJsonField,
  DomainFieldType,
} from "@/components/Form/DomainFieldRenderer/types";

/**
 * プロフィールフィールドの設定（DomainJsonField + profile固有拡張）
 * @see src/components/Form/DomainFieldRenderer/types.ts - DomainJsonField
 */
export type ProfileFieldConfig = DomainJsonField & {
  /** データ型（Drizzle スキーマ生成に必須） */
  fieldType: DomainFieldType;
  /** 説明文（フィールド下に表示） */
  description?: string;
};

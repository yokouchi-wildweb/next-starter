// src/features/core/userProfile/types/field.ts
// プロフィールフィールド関連の型定義

import type {
  FieldConfig,
  FieldDataType,
} from "@/components/Form/Field";

/**
 * プロフィールフィールドの設定（FieldConfig + profile固有拡張）
 * @see src/components/Form/FieldRenderer/types.ts - FieldConfig
 */
export type ProfileFieldConfig = FieldConfig & {
  /** データ型（Drizzle スキーマ生成に必須） */
  fieldType: FieldDataType;
  /** 説明文（フィールド下に表示） */
  description?: string;
};

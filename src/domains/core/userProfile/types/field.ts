// src/domains/core/userProfile/types/field.ts
// プロフィールフィールド関連の型定義

import type { FieldConfig } from "@/lib/formSuite";
import type { NeonFieldType } from "@/lib/domain";

/**
 * プロフィールフィールドの設定（FieldConfig + profile固有拡張）
 * @see src/lib/formSuite/FieldRenderer/types.ts - FieldConfig
 */
export type ProfileFieldConfig = FieldConfig & {
  /** データ型（Drizzle スキーマ生成に必須） */
  fieldType: NeonFieldType;
  /** 説明文（フィールド下に表示） */
  description?: string;
};

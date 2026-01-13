// src/features/core/userProfile/types/index.ts
// プロフィール関連の型定義

// re-export（利便性のため）
export type { ProfileFieldConfig } from "@/features/core/user/types";
export type {
  DomainFormInput,
  DomainFieldType,
} from "@/components/Form/DomainFieldRenderer/types";

/**
 * プロフィールデータの基本型
 * 各プロフィールテーブルで共通のフィールド
 */
export type BaseProfileData = {
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
};

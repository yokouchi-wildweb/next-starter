// src/features/core/userProfile/types/index.ts
// プロフィール関連の型定義
// ProfileFieldConfig などのロール設定型は src/config/app/roles.config.ts で定義

// re-export（利便性のため）
export type {
  ProfileFieldConfig,
  ProfileFormInputType,
} from "@/config/app/roles.config";

/**
 * プロフィールデータの基本型
 * 各プロフィールテーブルで共通のフィールド
 */
export type BaseProfileData = {
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
};

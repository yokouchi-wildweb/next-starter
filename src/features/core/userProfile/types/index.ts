// src/features/core/userProfile/types/index.ts
// プロフィール関連の型定義

export type { ProfileBase } from "./profileBase";

/**
 * プロフィールデータの基本型
 * 各プロフィールテーブルで共通のフィールド
 */
export type BaseProfileData = {
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
};

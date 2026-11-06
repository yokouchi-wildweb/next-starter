// src/features/core/userProfile/types/index.ts
// プロフィール関連の型定義

import type { ProfileConfig } from "../profiles";

export type { ProfileBase } from "./profileBase";
export type { ProfileFieldConfig } from "./field";
export type {
  CoreProfileFieldTag,
  ExtraProfileFieldTag,
  ProfileFieldTag,
} from "./fieldTag";

/**
 * fork の上書き（profiles/<JSON の名前>.override.ts の export const override）。pnpm generate role が読む。
 * 表の形を変える fields は上書きできない
 */
export type ProfileOverride = Partial<Pick<ProfileConfig, "tags" | "searchFields" | "audit">>;

/**
 * プロフィールデータの基本型
 * 各プロフィールテーブルで共通のフィールド
 */
export type BaseProfileData = {
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
};

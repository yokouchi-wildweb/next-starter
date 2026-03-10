// src/features/core/userProfile/profiles/index.ts
// プロフィール設定の型定義
//
// 各 profile.json は使用箇所で直接インポートすること
// 例: import userProfile from "@/features/core/userProfile/profiles/user.profile.json";

import type { ProfileFieldConfig } from "../types";

// JSON プロフィール設定の読み込み
import contributorProfile from "./contributor.profile.json";

// JSON プロフィール設定の読み込み

/**
 * プロフィールリレーション設定。
 * domain.json の relations と同じフォーマット。
 */
export type ProfileRelationConfig = {
  /** 関連先ドメイン名（snake_case） */
  domain: string;
  /** ラベル */
  label: string;
  /** フィールド名（belongsTo: 外部キー, belongsToMany: 配列フィールド） */
  fieldName: string;
  /** フィールドタイプ */
  fieldType: string;
  /** リレーションタイプ */
  relationType: "belongsTo" | "belongsToMany";
  /** 必須フラグ */
  required?: boolean;
  /** 削除時の挙動（belongsTo のみ） */
  onDelete?: string;
  /** 中間テーブルを生成するか（belongsToMany のみ） */
  includeRelationTable?: boolean;
  /** フォーム入力タイプ */
  formInput?: string;
};

/**
 * プロフィール設定の型
 */
export type ProfileConfig = {
  roleId: string;
  fields: ProfileFieldConfig[];
  tags?: Record<string, string[]>;
  /** keyword検索対象のカラム名（camelCase） */
  searchFields?: string[];
  /** リレーション設定（domain.json と同じフォーマット） */
  relations?: ProfileRelationConfig[];
};

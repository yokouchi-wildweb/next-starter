// src/lib/adminCommand/types.ts

/**
 * ========================================
 * definitions 用の型定義
 * ========================================
 *
 * カテゴリ実装で使用する型をここに定義
 * コア用の型は core/types.ts を参照
 */

import type { ReactNode } from "react";

/**
 * ナビゲーション項目の定義
 */
export type NavigationItem = {
  /** 一意識別子 */
  id: string;
  /** 表示ラベル */
  label: string;
  /** 説明文 */
  description?: string;
  /** アイコン */
  icon?: ReactNode;
  /** 遷移先URL */
  href: string;
  /** キーワード（検索用） */
  keywords?: string[];
};

/**
 * 設定項目の入力タイプ
 */
export type SettingInputType = "text" | "number";

/**
 * 設定項目の定義
 */
export type SettingFieldConfig = {
  /** 設定キー（Setting モデルのフィールド名） */
  key: string;
  /** 表示ラベル */
  label: string;
  /** 説明文 */
  description?: string;
  /** 入力タイプ */
  type: SettingInputType;
  /** プレースホルダー */
  placeholder?: string;
  /** バリデーション設定 */
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
};

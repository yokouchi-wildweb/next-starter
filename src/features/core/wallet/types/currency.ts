// src/features/core/wallet/types/currency.ts
// 通貨設定に関する型定義

import type { LucideIcon } from "lucide-react";

/**
 * 購入パッケージの型定義
 */
export type PurchasePackage = {
  /** 購入数量 */
  amount: number;
  /** 支払い金額（円） */
  price: number;
  /** ボーナス表示（例: "10%お得"） */
  bonus?: string;
};

/**
 * メタフィールドの入力種別
 */
export type CurrencyMetaFieldInputType = "textInput" | "textarea";

/**
 * メタフィールドの設定
 */
export type CurrencyMetaFieldConfig = {
  /** フィールド名（キー） */
  name: string;
  /** 表示ラベル */
  label: string;
  /** 入力種別 */
  formInput: CurrencyMetaFieldInputType;
  /** プレースホルダー */
  placeholder?: string;
  /** 説明文 */
  description?: string;
  /** 最大文字数 */
  maxLength?: number;
  /** テキストエリアの行数 */
  rows?: number;
};

/**
 * 通貨設定の型定義
 */
export type CurrencyConfig = {
  /** URLパス用スラッグ */
  slug: string;
  /** 表示ラベル */
  label: string;
  /** 単位（サフィックス） */
  unit: string;
  /** テーマカラー（HEX） */
  color: string;
  /** アイコンコンポーネント */
  icon: LucideIcon;
  /** 購入パッケージ一覧 */
  packages: PurchasePackage[];
  /** 管理画面で表示するメタフィールド */
  metaFields: CurrencyMetaFieldConfig[];
};

// src/features/core/wallet/currencyConfig.ts
// ウォレット通貨の設定ファイル
// ※ユーザー編集対象：ウォレット種別の追加・変更はこのファイルで行う

import { CircleDollarSign, Coins, Gift } from "lucide-react";

import type { CurrencyConfig } from "./types/currency";

/**
 * 通貨設定マップ
 * キー = walletType（DB値）
 *
 * 設定項目:
 * - slug: URLパス用（例: /wallet/coin）
 * - label: 表示名
 * - unit: 単位（例: "pt", "コイン"）
 * - color: テーマカラー（HEX）
 * - icon: アイコンコンポーネント
 * - packages: 購入パッケージ一覧
 * - metaFields: 管理画面での補足入力フィールド
 */
export const CURRENCY_CONFIG = {
  regular_coin: {
    slug: "coin",
    label: "コイン",
    unit: "コイン",
    color: "#F59E0B", // amber-500
    icon: CircleDollarSign,
    packages: [
      { amount: 500, price: 500 },
      { amount: 1000, price: 1000 },
      { amount: 2000, price: 2000 },
      { amount: 3000, price: 2940, bonus: "2%お得" },
      { amount: 4000, price: 3840, bonus: "4%お得" },
      { amount: 5000, price: 4700, bonus: "6%お得" },
      { amount: 10000, price: 8800, bonus: "12%お得" },
    ],
    metaFields: [
      {
        name: "productId",
        label: "商品ID",
        formInput: "textInput",
        placeholder: "例: ITEM-001",
        description: "対象の商品・アイテムなどがあれば入力してください。",
      },
      {
        name: "orderId",
        label: "注文ID",
        formInput: "textInput",
        placeholder: "例: ORDER-2024-0001",
      },
      {
        name: "notes",
        label: "管理者用詳細メモ",
        formInput: "textarea",
        placeholder: "社内メモや共有事項",
        rows: 2,
      },
    ],
  },
  regular_point: {
    slug: "point",
    label: "ポイント",
    unit: "pt",
    color: "#3B82F6", // blue-500
    icon: Coins,
    packages: [
      { amount: 100, price: 100 },
      { amount: 500, price: 500 },
      { amount: 1000, price: 1000 },
      { amount: 3000, price: 3000 },
      { amount: 5000, price: 5000 },
    ],
    metaFields: [
    ],
  },
  // temporary_point: {
  //   slug: "temporary-point",
  //   label: "期間限定ポイント",
  //   unit: "pt",
  //   color: "#EC4899", // pink-500
  //   icon: Gift,
  //   packages: [
  //     { amount: 100, price: 80, bonus: "20%お得" },
  //     { amount: 500, price: 400, bonus: "20%お得" },
  //     { amount: 1000, price: 800, bonus: "20%お得" },
  //   ],
  //   metaFields: [
  //   ],
  // },
} as const satisfies Record<string, CurrencyConfig>;

/**
 * ウォレット種別の型（キーから自動推論）
 */
export type WalletType = keyof typeof CURRENCY_CONFIG;

// src/features/core/walletHistory/types/reasonKey.ts
// 付与の種類(reason key)の項目の型(受け口: walletHistory/reasonKeys/<名前>.ts の export const reasonKey)。
// 1 項目 = 1 つの付与の施策(紹介報酬・登録ボーナス・ランクボーナスなど)。区分(reason_category)は種類から決まり、
// 書き込みで reasonKey を渡せば reason_category は category になる(両方渡して食い違えば書き手の誤りとして例外)。
// 詳細: src/features/core/walletHistory/README.md「付与の種類(reason key)」

import type { ReasonCategory } from "@/config/app/wallet-reason-category.config";

export type WalletReasonKeyItem = {
  /** 機械向けの名前(wallet_histories.reason_key に入る。snake_case、重複は一覧の読み込みで例外) */
  key: string;
  /** 管理画面の表示名(内訳の行など) */
  label: string;
  /** この種類の行の区分 */
  category: ReasonCategory;
  /** 表示順(小さいほど先、省略 = 0) */
  sortOrder?: number;
};

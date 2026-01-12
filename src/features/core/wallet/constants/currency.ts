// src/features/core/wallet/constants/currency.ts
// 通貨設定から派生する定数（自動生成）

import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";

/**
 * WalletTypeOptions（セレクトボックス等で使用）
 * CURRENCY_CONFIG から自動生成
 */
export const WalletTypeOptions = Object.entries(CURRENCY_CONFIG).map(
  ([value, config]) => ({
    value: value as WalletType,
    label: config.label,
  })
);

// src/features/core/wallet/constants/currency.ts
// 通貨設定から派生する定数（自動生成）

import { walletConfig, type WalletType } from "@/features/wallet/config";

/**
 * WalletTypeOptions（セレクトボックス等で使用）
 * walletConfig.currency から自動生成
 */
export const WalletTypeOptions = Object.entries(walletConfig.currency).map(
  ([value, config]) => ({
    value: value as WalletType,
    label: config.label,
  })
);

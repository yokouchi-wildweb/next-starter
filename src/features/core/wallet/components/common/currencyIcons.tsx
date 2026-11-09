// src/features/core/wallet/components/common/currencyIcons.tsx
// 通貨種別ごとのアイコンの読み手（値は src/features/core/wallet/config.ui.ts の currencyIcons）

import type { LucideIcon } from "lucide-react";

import type { WalletType } from "@/features/wallet/config";
import { walletUiConfig } from "@/features/wallet/config.ui";

/**
 * 通貨種別 → アイコンコンポーネントのマッピング
 *
 * コンポーネントの render 内では getCurrencyIcon ではなくこの定数を直接参照すること
 * (関数の戻り値をコンポーネントにすると react-hooks/static-components に掛かる)
 */
export const currencyIcons = walletUiConfig.currencyIcons;

/**
 * 通貨種別からアイコンコンポーネントを取得
 */
export function getCurrencyIcon(walletType: WalletType): LucideIcon {
  return currencyIcons[walletType];
}

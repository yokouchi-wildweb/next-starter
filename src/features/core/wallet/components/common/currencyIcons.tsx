// src/features/core/wallet/components/common/currencyIcons.tsx
// 通貨種別ごとのアイコンの読み手（値は src/config/ui/currency-icons.config.ts）

import type { LucideIcon } from "lucide-react";

import type { WalletType } from "@/config/app/currency.config";
import { CURRENCY_ICONS } from "@/config/ui/currency-icons.config";

/**
 * 通貨種別 → アイコンコンポーネントのマッピング
 *
 * コンポーネントの render 内では getCurrencyIcon ではなくこの定数を直接参照すること
 * (関数の戻り値をコンポーネントにすると react-hooks/static-components に掛かる)
 */
export const currencyIcons = CURRENCY_ICONS;

/**
 * 通貨種別からアイコンコンポーネントを取得
 */
export function getCurrencyIcon(walletType: WalletType): LucideIcon {
  return currencyIcons[walletType];
}

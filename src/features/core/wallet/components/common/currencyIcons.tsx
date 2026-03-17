// src/features/core/wallet/components/common/currencyIcons.tsx
// 通貨種別ごとのアイコンマッピング（UIレイヤー）
// currency.config.ts を純粋なデータに保つため、アイコンの紐付けはここで行う

import { CircleDollarSign, Coins } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WalletType } from "@/config/app/currency.config";

/**
 * 通貨種別 → アイコンコンポーネントのマッピング
 *
 * [!!] currency.config.ts に通貨を追加・削除した場合はここも更新すること
 */
const currencyIcons: Record<WalletType, LucideIcon> = {
  regular_coin: CircleDollarSign,
  regular_point: Coins,
};

/**
 * 通貨種別からアイコンコンポーネントを取得
 */
export function getCurrencyIcon(walletType: WalletType): LucideIcon {
  return currencyIcons[walletType];
}

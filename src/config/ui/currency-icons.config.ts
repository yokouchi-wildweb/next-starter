// src/config/ui/currency-icons.config.ts
// 通貨種別 → アイコン。currency.config.ts を純粋なデータに保つため、アイコンの紐付けはここで行う。
// [!!] currency.config.ts に通貨を追加・削除した場合はここも更新すること

import { CircleDollarSign, Coins } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { WalletType } from "@/config/app/currency.config";

export const CURRENCY_ICONS: Record<WalletType, LucideIcon> = {
  regular_coin: CircleDollarSign,
  regular_point: Coins,
};

// src/features/core/wallet/config.ui.ts
// ウォレットの描画専用の設定(既定 + 上書き)。上書きは src/config/features/wallet.ui.config.ts(このファイルだけが読む)。
// 値の設定は ./config.ts(通貨の値と純粋なデータ)、アイコン(部品)はここ。置き方: src/config/README.md
// [!!] 通貨を足した・消した場合は currencyIcons も揃えること(足した通貨のアイコンは上書きで書く)

import { CircleDollarSign, Coins } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import override from "@/config/features/wallet.ui.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

/** 上書きの中で読んでよい指定子(アイコンの部品) */
export const overrideImports = ["lucide-react"] as const;

export type WalletUiConfig = {
  /** 通貨種別 → アイコン(キー = walletType) */
  currencyIcons: Record<string, LucideIcon>;
};

const defaults: WalletUiConfig = {
  currencyIcons: {
    regular_coin: CircleDollarSign,
    regular_point: Coins,
  },
};

export const walletUiConfigDef = defineConfig<WalletUiConfig>(defaults, { label: "wallet.ui" });

/** 上書きのファイルの型(`export default { ... } satisfies WalletUiOverride`) */
export type WalletUiOverride<E extends object = Record<never, never>> = OverrideOf<typeof walletUiConfigDef, E>;

/** 合成済みの描画用の設定 */
export const walletUiConfig = walletUiConfigDef.compose(override);

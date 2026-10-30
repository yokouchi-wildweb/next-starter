// src/app/(user)/(protected)/wallet/_screen/loader.ts
// /wallet の loader(page 層が呼ぶサーバー側ロジック)。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 (user)/(protected) の createLoader(access authenticated。未ログインは /login)。設定順の通貨一覧を返す。

import "server-only";

import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import type { WalletIndexEntry } from "@/features/core/wallet/types/screen";
import { createLoader } from "@/app/(user)/(protected)/guard";

export type WalletIndexScreenData = {
  /** 設定順の通貨一覧 */
  wallets: WalletIndexEntry[];
};

export const loadWalletIndexScreen = createLoader({
  access: "authenticated",
  load: async (): Promise<WalletIndexScreenData> => {
    const wallets = (Object.keys(CURRENCY_CONFIG) as WalletType[]).map((walletType) => ({
      walletType,
      slug: CURRENCY_CONFIG[walletType].slug,
      label: CURRENCY_CONFIG[walletType].label,
    }));
    return { wallets };
  },
});

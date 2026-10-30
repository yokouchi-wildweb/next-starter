// src/app/(user)/(protected)/wallet/[slug]/history/_screen/loader.ts
// /wallet/[slug]/history の loader(page 層が呼ぶサーバー側ロジック)。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 (user)/(protected) の createLoader(access authenticated。未ログインは /login)。未知の slug は notFound。
// 履歴本体はセクションコンテナ(WalletHistory)が hook(useMyWalletHistoryBatches)で取得する。

import "server-only";
import { notFound } from "next/navigation";

import type { WalletType } from "@/config/app/currency.config";
import type { ScreenProps } from "@/lib/screens/types";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";
import { createLoader } from "@/app/(user)/(protected)/guard";

export type WalletHistoryScreenParams = { slug: string };

export type WalletHistoryScreenData = {
  slug: string;
  walletType: WalletType;
  label: string;
};

export const loadWalletHistoryScreen = createLoader({
  access: "authenticated",
  key: async (props: ScreenProps<WalletHistoryScreenParams>): Promise<[string]> => [(await props.params).slug],
  load: async (_ctx, slug): Promise<WalletHistoryScreenData> => {
    const config = getCurrencyConfigBySlug(slug);
    if (!config) {
      notFound();
    }
    return { slug, walletType: config.walletType, label: config.label };
  },
});

// src/app/(user)/(protected)/wallet/[slug]/purchase/_screen/loader.ts
// /wallet/[slug]/purchase(決済方法選択)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 (user)/(protected) の createLoader(access authenticated。未ログインは /login)。未知の slug は notFound。サーバー側の取得は無く、通貨設定(表示名)を解決して返すだけ。
// 本人の残高や進行中の振込はセクションコンテナ(WalletPurchase)が hook で取得する。

import "server-only";

import { notFound } from "next/navigation";

import type { ScreenProps } from "@/lib/screens/types";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";
import { createLoader } from "@/app/(user)/(protected)/guard";

export type WalletPurchaseScreenParams = { slug: string };

export type WalletPurchaseScreenData = {
  slug: string;
  /** 通貨の表示名(タイトル用) */
  label: string;
};

export const loadWalletPurchaseScreen = createLoader({
  access: "authenticated",
  key: async (props: ScreenProps<WalletPurchaseScreenParams>): Promise<[string]> => [(await props.params).slug],
  load: async (_ctx, slug): Promise<WalletPurchaseScreenData> => {
    const config = getCurrencyConfigBySlug(slug);
    if (!config) {
      notFound();
    }
    return { slug, label: config.label };
  },
});

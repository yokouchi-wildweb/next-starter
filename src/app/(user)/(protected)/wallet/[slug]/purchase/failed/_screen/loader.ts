// src/app/(user)/(protected)/wallet/[slug]/purchase/failed/_screen/loader.ts
// /wallet/[slug]/purchase/failed(購入エラー)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 (user)/(protected) の createLoader(access authenticated。未ログインは /login)。未知の slug は notFound。サーバー側の取得は無い。エラー内容(error_code / reason)はセクションコンテナが URL から読む。

import "server-only";

import { notFound } from "next/navigation";

import type { ScreenProps } from "@/lib/screens/types";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";
import { createLoader } from "@/app/(user)/(protected)/guard";

export type WalletPurchaseFailedScreenParams = { slug: string };

/** 検証済みの slug だけ(画面はこれ以外をサーバーから受け取らない) */
export type WalletPurchaseFailedScreenData = { slug: string };

export const loadWalletPurchaseFailedScreen = createLoader({
  access: "authenticated",
  key: async (props: ScreenProps<WalletPurchaseFailedScreenParams>): Promise<[string]> => [(await props.params).slug],
  load: async (_ctx, slug): Promise<WalletPurchaseFailedScreenData> => {
    if (!getCurrencyConfigBySlug(slug)) {
      notFound();
    }
    return { slug };
  },
});

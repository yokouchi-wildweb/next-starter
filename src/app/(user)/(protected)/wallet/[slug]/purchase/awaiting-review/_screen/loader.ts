// src/app/(user)/(protected)/wallet/[slug]/purchase/awaiting-review/_screen/loader.ts
// /wallet/[slug]/purchase/awaiting-review(銀行振込の確認待ち案内)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 (user)/(protected) の createLoader(access authenticated。未ログインは /login)。未知の slug は notFound。サーバー側の取得は無い。購入情報(request_id)はセクションコンテナが hook で取得する。

import "server-only";

import { notFound } from "next/navigation";

import type { ScreenProps } from "@/lib/screens/types";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";
import { createLoader } from "@/app/(user)/(protected)/guard";

export type WalletPurchaseAwaitingReviewScreenParams = { slug: string };

/** 検証済みの slug だけ(画面はこれ以外をサーバーから受け取らない) */
export type WalletPurchaseAwaitingReviewScreenData = { slug: string };

export const loadWalletPurchaseAwaitingReviewScreen = createLoader({
  access: "authenticated",
  key: async (props: ScreenProps<WalletPurchaseAwaitingReviewScreenParams>): Promise<[string]> => [(await props.params).slug],
  load: async (_ctx, slug): Promise<WalletPurchaseAwaitingReviewScreenData> => {
    if (!getCurrencyConfigBySlug(slug)) {
      notFound();
    }
    return { slug };
  },
});

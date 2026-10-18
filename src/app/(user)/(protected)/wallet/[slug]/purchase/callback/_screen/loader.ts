// src/app/(user)/(protected)/wallet/[slug]/purchase/callback/_screen/loader.ts
// /wallet/[slug]/purchase/callback(決済プロバイダからの戻り先。ステータスをポーリングして complete / failed へ送る)の loader。
// 上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 未知の slug は notFound。サーバー側の取得は無い。ポーリングはセクションコンテナ(PurchaseCallback)の hook が行う。

import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";

import type { ScreenProps } from "@/lib/screens/types";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";

export type WalletPurchaseCallbackScreenParams = { slug: string };

/** 検証済みの slug だけ(画面はこれ以外をサーバーから受け取らない) */
export type WalletPurchaseCallbackScreenData = { slug: string };

const resolveWalletPurchaseCallbackScreen = cache(
  async (slug: string): Promise<WalletPurchaseCallbackScreenData> => {
    if (!getCurrencyConfigBySlug(slug)) {
      notFound();
    }
    return { slug };
  },
);

export async function loadWalletPurchaseCallbackScreen(
  props: ScreenProps<WalletPurchaseCallbackScreenParams>,
): Promise<WalletPurchaseCallbackScreenData> {
  const { slug } = await props.params;
  return resolveWalletPurchaseCallbackScreen(slug);
}

// src/app/(user)/(protected)/wallet/[slug]/purchase/complete/_screen/loader.ts
// /wallet/[slug]/purchase/complete(購入完了)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 未知の slug は notFound。サーバー側の取得は無い。購入情報(request_id)はセクションコンテナが hook で取得する。

import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";

import type { ScreenProps } from "@/lib/screens/types";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";

export type WalletPurchaseCompleteScreenParams = { slug: string };

/** 検証済みの slug だけ(画面はこれ以外をサーバーから受け取らない) */
export type WalletPurchaseCompleteScreenData = { slug: string };

const resolveWalletPurchaseCompleteScreen = cache(
  async (slug: string): Promise<WalletPurchaseCompleteScreenData> => {
    if (!getCurrencyConfigBySlug(slug)) {
      notFound();
    }
    return { slug };
  },
);

export async function loadWalletPurchaseCompleteScreen(
  props: ScreenProps<WalletPurchaseCompleteScreenParams>,
): Promise<WalletPurchaseCompleteScreenData> {
  const { slug } = await props.params;
  return resolveWalletPurchaseCompleteScreen(slug);
}

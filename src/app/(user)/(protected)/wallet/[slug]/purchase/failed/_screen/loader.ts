// src/app/(user)/(protected)/wallet/[slug]/purchase/failed/_screen/loader.ts
// /wallet/[slug]/purchase/failed(購入エラー)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 未知の slug は notFound。サーバー側の取得は無い。エラー内容(error_code / reason)はセクションコンテナが URL から読む。

import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";

import type { ScreenProps } from "@/lib/screens/types";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";

export type WalletPurchaseFailedScreenParams = { slug: string };

/** 検証済みの slug だけ(画面はこれ以外をサーバーから受け取らない) */
export type WalletPurchaseFailedScreenData = { slug: string };

const resolveWalletPurchaseFailedScreen = cache(
  async (slug: string): Promise<WalletPurchaseFailedScreenData> => {
    if (!getCurrencyConfigBySlug(slug)) {
      notFound();
    }
    return { slug };
  },
);

export async function loadWalletPurchaseFailedScreen(
  props: ScreenProps<WalletPurchaseFailedScreenParams>,
): Promise<WalletPurchaseFailedScreenData> {
  const { slug } = await props.params;
  return resolveWalletPurchaseFailedScreen(slug);
}

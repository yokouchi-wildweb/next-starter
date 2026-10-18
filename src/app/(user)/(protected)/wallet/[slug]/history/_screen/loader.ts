// src/app/(user)/(protected)/wallet/[slug]/history/_screen/loader.ts
// /wallet/[slug]/history の loader(page 層が呼ぶサーバー側ロジック)。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4

import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";

import type { WalletType } from "@/config/app/currency.config";
import type { ScreenProps } from "@/lib/screens/types";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";

export type WalletHistoryScreenParams = { slug: string };

export type WalletHistoryScreenData = {
  slug: string;
  walletType: WalletType;
  label: string;
};

// cache() のキーは引数の同一性のため、props ではなく解決済みの slug でメモ化する
const resolveWalletHistoryScreen = cache(async (slug: string): Promise<WalletHistoryScreenData> => {
  const config = getCurrencyConfigBySlug(slug);
  if (!config) {
    notFound();
  }

  await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" });

  return {
    slug,
    walletType: config.walletType,
    label: config.label,
  };
});

/**
 * 履歴画面のデータ。
 * 未知の slug は notFound、未ログインは /login へ redirect する。
 * 履歴本体はセクションコンテナ(WalletHistoryPage)が hook(useMyWalletHistoryBatches)で取得する。
 */
export async function loadWalletHistoryScreen(
  props: ScreenProps<WalletHistoryScreenParams>,
): Promise<WalletHistoryScreenData> {
  const { slug } = await props.params;
  return resolveWalletHistoryScreen(slug);
}

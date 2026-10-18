// src/app/(user)/(protected)/wallet/_screen/loader.ts
// /wallet の loader(page 層が呼ぶサーバー側ロジック)。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4

import "server-only";
import { cache } from "react";

import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";
import type { WalletIndexEntry } from "@/features/core/wallet/types/screen";

export type WalletIndexScreenData = {
  /** 設定順の通貨一覧 */
  wallets: WalletIndexEntry[];
};

/**
 * ウォレット一覧画面のデータ。
 * 未ログイン(または DB にユーザーが無い)は /login へ redirect する。
 * 既定 Screen も下流の Screen もこれを呼ぶ。
 */
export const loadWalletIndexScreen = cache(async (): Promise<WalletIndexScreenData> => {
  await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" });

  const wallets = (Object.keys(CURRENCY_CONFIG) as WalletType[]).map((walletType) => ({
    walletType,
    slug: CURRENCY_CONFIG[walletType].slug,
    label: CURRENCY_CONFIG[walletType].label,
  }));

  return { wallets };
});

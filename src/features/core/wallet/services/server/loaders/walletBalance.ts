// src/features/core/wallet/services/server/loaders/walletBalance.ts
// /wallet/[slug] の loader。一覧・返り値・規則: ./README.md

import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";

import type { WalletType } from "@/config/app/currency.config";
import type { ScreenProps } from "@/lib/screens/types";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";

export type WalletBalanceScreenParams = { slug: string };

/** 画面が必要とする最小のデータ。loader が明示的に組み立てる(余分なフィールドを渡さない) */
export type WalletBalanceScreenData = {
  slug: string;
  walletType: WalletType;
  label: string;
  /** 電話番号認証日時(未認証なら null) */
  phoneVerifiedAt: Date | null;
  /** 現在の電話番号(未登録なら null) */
  phoneNumber: string | null;
};

// cache() のキーは引数の同一性。Next は page と generateMetadata に別の props オブジェクトを
// 渡すため、props ではなく解決済みの slug(プリミティブ)でメモ化する
const resolveWalletBalanceScreen = cache(async (slug: string): Promise<WalletBalanceScreenData> => {
  const config = getCurrencyConfigBySlug(slug);
  if (!config) {
    notFound();
  }

  const user = await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" });

  return {
    slug,
    walletType: config.walletType,
    label: config.label,
    phoneVerifiedAt: user.phoneVerifiedAt,
    phoneNumber: user.phoneNumber,
  };
});

/**
 * 残高画面のデータ。
 * 未知の slug は notFound、未ログインは /login へ redirect する。
 * 既定 Screen も下流の Screen も generateMetadata もこれを呼ぶ(同一リクエスト内は 1 回だけ解決される)。
 */
export async function loadWalletBalanceScreen(
  props: ScreenProps<WalletBalanceScreenParams>,
): Promise<WalletBalanceScreenData> {
  const { slug } = await props.params;
  return resolveWalletBalanceScreen(slug);
}

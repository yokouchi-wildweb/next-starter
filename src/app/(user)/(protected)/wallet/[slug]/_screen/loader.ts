// src/app/(user)/(protected)/wallet/[slug]/_screen/loader.ts
// /wallet/[slug] の loader(page 層が呼ぶサーバー側ロジック)。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 未知の slug は notFound、未ログインは /login へ。通貨設定と本人の電話番号に加え、初回描画に見える残高
// (本人の全ウォレット)を /api/me/wallet と同じ ServerService 呼び出しで取り、Screen が WalletBalance の
// initialWallets に渡す(取得の境目: must-read §3。クライアントの hook はこれを fallbackData にして初回の取り直しをしない)

import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";

import type { WalletType } from "@/config/app/currency.config";
import type { ScreenProps } from "@/lib/screens/types";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";
import type { Wallet } from "@/features/core/wallet/entities";
import { walletService } from "@/features/core/wallet/services/server/walletService";
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
  /** 本人の全ウォレット(通貨種別ごと)。初回描画用。/api/me/wallet と同じ取得 */
  wallets: Wallet[];
};

// cache() のキーは引数の同一性。Next は page と generateMetadata に別の props オブジェクトを
// 渡すため、props ではなく解決済みの slug(プリミティブ)でメモ化する
const resolveWalletBalanceScreen = cache(async (slug: string): Promise<WalletBalanceScreenData> => {
  const config = getCurrencyConfigBySlug(slug);
  if (!config) {
    notFound();
  }

  const user = await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" });
  const balances = await walletService.search({ where: { field: "user_id", op: "eq", value: user.id } });

  return {
    slug,
    walletType: config.walletType,
    label: config.label,
    phoneVerifiedAt: user.phoneVerifiedAt,
    phoneNumber: user.phoneNumber,
    wallets: balances.results ?? [],
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

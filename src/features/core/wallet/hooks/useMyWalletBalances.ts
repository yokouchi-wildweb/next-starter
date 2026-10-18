// src/features/wallet/hooks/useMyWalletBalances.ts

"use client";

import useSWR, { useSWRConfig } from "swr";

import type { Wallet } from "@/features/core/wallet/entities";
import { walletClient } from "@/features/core/wallet/services/client/walletClient";

export type WalletBalanceResult = {
  wallets: Wallet[];
};

type UseMyWalletBalancesOptions = {
  /**
   * loader がサーバーで取った初期データ(must-read §3 の取得の境目)。
   * 指定時は初回描画にそのまま使い、SWR キャッシュが空ならマウント時の再検証もしない(往復 1 回を削る)。
   * キャッシュに既にデータがあるとき(クライアント遷移で戻ってきたとき)は SWR がキャッシュを優先して描くので、
   * 古い値を出し続けないよう従来どおりマウント時に再検証する
   */
  fallbackData?: WalletBalanceResult;
};

/**
 * 本人のウォレット残高を取得する（/api/me/wallet）。
 *
 * オーナーシップはサーバーが session（user.userId）で強制するため、取得対象は
 * クライアントから指定できない。userId は「ログイン済みか」のゲート兼 SWR キャッシュキー
 * としてのみ使う。他ユーザーの残高を見る管理用途は useWalletBalances（admin 専用 API）を使う。
 */
export const useMyWalletBalances = (userId?: string | null, { fallbackData }: UseMyWalletBalancesOptions = {}) => {
  const { cache } = useSWRConfig();
  const key = userId ? `my-wallet-balances:${userId}` : null;
  const hasCachedData = key !== null && cache.get(key)?.data !== undefined;

  return useSWR<WalletBalanceResult>(key, () => walletClient.getMyBalances(), {
    fallbackData,
    // 未指定だと revalidateIfStale(既定 true)に従って fallbackData があっても取り直すので明示する。
    // 初期データが無い、またはキャッシュが既にある(= fallbackData より優先される)ときだけマウント時に取り直す
    revalidateOnMount: fallbackData === undefined || hasCachedData,
  });
};

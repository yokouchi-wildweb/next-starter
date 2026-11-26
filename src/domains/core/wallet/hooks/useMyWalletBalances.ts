// src/domains/wallet/hooks/useMyWalletBalances.ts

"use client";

import { useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";

import { useAuthSession } from "@/domains/core/auth/hooks/useAuthSession";

import type { Wallet } from "@/domains/core/wallet/entities";
import { walletClient } from "@/domains/core/wallet/services/client/walletClient";

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

/** 本人の残高の SWR キー(取得と取り直しが同じ物を使う)。未ログインは null */
export const myWalletBalancesKey = (userId?: string | null): string | null =>
  userId ? `my-wallet-balances:${userId}` : null;

/**
 * 本人のウォレット残高を取得する（/api/me/wallet）。
 *
 * オーナーシップはサーバーが session（user.userId）で強制するため、取得対象は
 * クライアントから指定できない。userId は「ログイン済みか」のゲート兼 SWR キャッシュキー
 * としてのみ使う。他ユーザーの残高を見る管理用途は useWalletBalances（admin 専用 API）を使う。
 */
export const useMyWalletBalances = (userId?: string | null, { fallbackData }: UseMyWalletBalancesOptions = {}) => {
  const { cache } = useSWRConfig();
  const key = myWalletBalancesKey(userId);
  const hasCachedData = key !== null && cache.get(key)?.data !== undefined;

  return useSWR<WalletBalanceResult>(key, () => walletClient.getMyBalances(), {
    fallbackData,
    // 未指定だと revalidateIfStale(既定 true)に従って fallbackData があっても取り直すので明示する。
    // 初期データが無い、またはキャッシュが既にある(= fallbackData より優先される)ときだけマウント時に取り直す
    revalidateOnMount: fallbackData === undefined || hasCachedData,
  });
};

/**
 * 本人の残高の取り直し: 残高を変えた操作(購入の完了など)の後に呼ぶ。
 * 返す関数は今のログインの利用者の残高を取り直す(表示中の useMyWalletBalances が新しい値で描き直す)。未ログインなら何もしない
 */
export const useRefreshMyWalletBalances = () => {
  const { mutate } = useSWRConfig();
  const { user } = useAuthSession();
  const key = myWalletBalancesKey(user?.userId);
  return useCallback(async () => {
    if (key) await mutate(key);
  }, [mutate, key]);
};

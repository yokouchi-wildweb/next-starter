// src/features/wallet/hooks/useMyWalletBalances.ts

"use client";

import useSWR from "swr";

import type { Wallet } from "@/features/core/wallet/entities";
import { walletClient } from "@/features/core/wallet/services/client/walletClient";

type WalletBalanceResult = {
  wallets: Wallet[];
};

/**
 * 本人のウォレット残高を取得する（/api/me/wallet）。
 *
 * オーナーシップはサーバーが session（user.userId）で強制するため、取得対象は
 * クライアントから指定できない。userId は「ログイン済みか」のゲート兼 SWR キャッシュキー
 * としてのみ使う。他ユーザーの残高を見る管理用途は useWalletBalances（admin 専用 API）を使う。
 */
export const useMyWalletBalances = (userId?: string | null) =>
  useSWR<WalletBalanceResult>(
    userId ? `my-wallet-balances:${userId}` : null,
    () => walletClient.getMyBalances(),
  );

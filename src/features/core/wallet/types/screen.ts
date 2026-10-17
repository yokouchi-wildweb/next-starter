// src/features/core/wallet/types/screen.ts
// 画面(loader の返り値 / セクションコンテナの props)で共有する型

import type { WalletType } from "@/config/app/currency.config";

/** ウォレット一覧の 1 行分。loadWalletIndexScreen の返り値と WalletIndexPage の props が共有する */
export type WalletIndexEntry = {
  walletType: WalletType;
  slug: string;
  label: string;
};

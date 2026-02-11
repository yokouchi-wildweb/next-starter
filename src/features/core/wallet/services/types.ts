// src/features/wallet/services/types.ts

import type { Wallet } from "@/features/core/wallet/entities";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import type { WalletHistory } from "@/features/core/walletHistory/entities";
import type { WalletHistoryChangeMethodValue, WalletHistorySourceTypeValue } from "@/features/core/walletHistory/types/field";
import type { WalletHistoryMetaInput } from "@/features/core/walletHistory/types/meta";

export type WalletAdjustmentResult = {
  wallet: Wallet;
  /** skipHistory: true の場合は null */
  history: WalletHistory | null;
};

export type AdjustWalletParams = {
  userId: string;
  walletType: WalletTypeValue;
  changeMethod: WalletHistoryChangeMethodValue;
  amount: number;
  sourceType: WalletHistorySourceTypeValue;
  requestBatchId?: string | null;
  reason?: string | null;
  meta?: WalletHistoryMetaInput;
};

export type ReserveWalletParams = {
  userId: string;
  walletType: WalletTypeValue;
  amount: number;
};

export type ReleaseReservationParams = ReserveWalletParams;

export type ConsumeReservationParams = {
  userId: string;
  walletType: WalletTypeValue;
  amount: number;
  sourceType: WalletHistorySourceTypeValue;
  requestBatchId?: string | null;
  reason?: string | null;
  meta?: WalletHistoryMetaInput;
};

export type WalletAdjustRequestPayload = {
  walletType: WalletTypeValue;
  changeMethod: WalletHistoryChangeMethodValue;
  amount: number;
  requestBatchId?: string | null;
  reason?: string | null;
  meta?: WalletHistoryMetaInput;
};

/** Wallet操作の共通オプション */
export type WalletOperationOptions = {
  /** trueの場合、SELECT FOR UPDATEで行ロックを取得 */
  lock?: boolean;
};

/** adjustBalance用のオプション */
export type AdjustBalanceOptions = WalletOperationOptions & {
  /** trueの場合、履歴記録をスキップ */
  skipHistory?: boolean;
};

/** getWallet用のオプション */
export type GetWalletOptions = WalletOperationOptions & {
  /** falseの場合、存在しなければnullを返す（デフォルト: true） */
  createIfNotExists?: boolean;
};

/** 通貨種別ごとの全ユーザー合計残高 */
export type TotalBalanceByType = {
  type: WalletTypeValue;
  totalBalance: number;
  totalLockedBalance: number;
};

/** getTotalBalancesByType のフィルタオプション */
export type TotalBalancesByTypeOptions = {
  /** 指定したロールのユーザーのみ集計 */
  role?: string;
};
